// tslint:disable:no-implicit-dependencies
import { JsonObject, logging } from '@angular-devkit/core';
import chalk from 'chalk';
import * as program from 'commander';
import * as ejs from 'ejs';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import { packages } from './packages';
import * as versionsHelper from './versions';

const changelogTemplate = ejs.compile(
  fs.readFileSync('./scripts/templates/changelog.ejs', 'utf-8'),
  { client: true }
);

const conventionalCommitsParser = require('conventional-commits-parser');
const gitRawCommits = require('git-raw-commits');
const ghGot = require('gh-got');
const through = require('through2');

export interface ChangelogOptions {
  to: string;
  githubTokenFile?: string;
  githubToken?: string;
  library?: string;
  stdout?: boolean;
}

const breakingChangesKeywords = ['BREAKING CHANGE', 'BREAKING CHANGES'];
const deprecationsKeywords = ['DEPRECATION', 'DEPRECATED', 'DEPRECATIONS'];

export default async function run(
  args: ChangelogOptions,
  logger: logging.Logger
) {
  const commits: JsonObject[] = [];
  let toSha: string | null = null;
  const breakingChanges: JsonObject[] = [];
  const deprecations: JsonObject[] = [];
  const versionFromTag = args.to
    .split('-')
    .filter((_, i) => i !== 0)
    .join('-');
  const newVersion = semver.parse(versionFromTag, {
    includePrerelease: true,
    loose: true,
  });
  let fromToken: string;
  try {
    const packageVersions = await versionsHelper.fetchPackageVersions(
      args.library
    );
    const previousVersion = versionsHelper.extractPreviousVersionForChangelog(
      packageVersions,
      newVersion.version
    );
    fromToken =
      previousVersion && args.to.split(newVersion).join(previousVersion);
  } catch (err) {
    // package not found - assuming first release
    fromToken = '';
  }

  const githubToken = (
    args.githubToken ||
    (args.githubTokenFile && fs.readFileSync(args.githubTokenFile, 'utf-8')) ||
    ''
  ).trim();

  const libraryPaths = {
    '@spartacus/storefront': './projects/storefrontlib',
    '@spartacus/core': './projects/core',
    '@spartacus/styles': './projects/storefrontstyles',
    '@spartacus/assets': './projects/assets',
    '@spartacus/schematics': './projects/schematics',
    '@spartacus/incubator': './projects/incubator',
  };

  const duplexUtil = through(function(chunk, _, callback) {
    this.push(chunk);
    callback();
  });

  function getRawCommitsStream(to: string) {
    return gitRawCommits({
      from: fromToken,
      to,
      path: args.library ? libraryPaths[args.library] : '.',
      format:
        '%B%n-hash-%n%H%n-gitTags-%n%D%n-committerDate-%n%ci%n-authorName-%n%aN%n',
    }) as NodeJS.ReadStream;
  }

  function getCommitsStream(): NodeJS.ReadStream {
    getRawCommitsStream(args.to)
      .on('error', () => {
        getRawCommitsStream('HEAD')
          .on('error', err => {
            logger.fatal('An error happened: ' + err.message);
            return '';
          })
          .pipe(duplexUtil);
      })
      .pipe(duplexUtil);

    return duplexUtil;
  }

  return new Promise(resolve => {
    getCommitsStream()
      .pipe(
        through((chunk: Buffer, _: string, callback: Function) => {
          // Replace github URLs with `@XYZ#123`
          const commit = chunk
            .toString('utf-8')
            .replace(/https?:\/\/github.com\/(.*?)\/issues\/(\d+)/g, '@$1#$2');

          callback(undefined, new Buffer(commit));
        })
      )
      .pipe(
        conventionalCommitsParser({
          headerPattern: /^(\w*)(?:\(([^)]*)\))?: (.*)$/,
          headerCorrespondence: ['type', 'scope', 'subject'],
          noteKeywords: [...breakingChangesKeywords, ...deprecationsKeywords],
          revertPattern: /^revert:\s([\s\S]*?)\s*This reverts commit (\w*)\./,
          revertCorrespondence: [`header`, `hash`],
        })
      )
      .pipe(
        through.obj((chunk: JsonObject, _: string, cb: Function) => {
          try {
            const maybeTag =
              chunk.gitTags && (chunk.gitTags as string).match(/tag: (.*)/);
            const tags = maybeTag && maybeTag[1].split(/,/g);
            chunk['tags'] = tags;
            // tslint:disable-next-line:triple-equals
            if (tags && tags.find(x => x == args.to)) {
              toSha = chunk.hash as string;
            }
            const notes: any = chunk.notes;
            if (Array.isArray(notes)) {
              notes.forEach(note => {
                if (breakingChangesKeywords.includes(note.title)) {
                  breakingChanges.push({
                    content: note.text,
                    commit: chunk,
                  });
                } else if (deprecationsKeywords.includes(note.title)) {
                  deprecations.push({
                    content: note.text,
                    commit: chunk,
                  });
                }
              });
            }
            commits.push(chunk);
            cb();
          } catch (err) {
            cb(err);
          }
        })
      )
      .on('finish', resolve);
  })
    .then(() => {
      const markdown: string = changelogTemplate({
        ...args,
        include: (x: string, v: {}) =>
          ejs.render(
            fs.readFileSync(
              path.join('./scripts/templates', `${x}.ejs`),
              'utf-8'
            ),
            v
          ),
        commits,
        packages,
        breakingChanges,
        deprecations,
      });

      if (args.stdout || !githubToken) {
        console.log(markdown);
        process.exit(0);
      }

      // Check if we need to edit or create a new one.
      return ghGot(
        'repos/SAP/cloud-commerce-spartacus-storefront/releases'
      ).then((x: JsonObject) => [x, markdown]);
    })
    .then(([body, markdown]) => {
      const json = body.body;
      // tslint:disable-next-line:triple-equals
      const maybeRelease = json.find((x: JsonObject) => x.tag_name == args.to);
      const id = maybeRelease ? `/${maybeRelease.id}` : '';

      const semversion = (args.to && semver.parse(args.to)) || {
        prerelease: '',
      };

      return ghGot(
        'repos/SAP/cloud-commerce-spartacus-storefront/releases' + id,
        {
          body: {
            body: markdown,
            draft: true,
            name: args.to,
            prerelease: semversion.prerelease.length > 0,
            tag_name: args.to,
            ...(toSha ? { target_commitish: toSha } : {}),
          },
          token: githubToken,
        }
      );
    });
}

program
  .option('--to <commit>', 'To which commit/tag')
  .option('--verbose', 'Print output')
  .option('--githubToken <token>', 'Github token for release generation')
  .option('--tokenFile <pathToFile>', 'File with github token')
  .option('--lib <lib>', 'Changelog for passed library')
  .parse(process.argv);

const config = {
  from: program.from,
  to: program.to,
  stdout: program.verbose || false,
  githubToken: program.githubToken,
  githubTokenFile: program.tokenFile,
  library: program.lib,
};

if (typeof config.to === 'undefined') {
  console.error(chalk.red('Missing --to option with end commit/tag'));
  process.exit(1);
} else if (
  config.stdout === false &&
  typeof config.githubToken === 'undefined' &&
  typeof config.githubTokenFile === 'undefined'
) {
  console.error(
    chalk.red(
      'Missing --githubToken/--tokenFile option with correct github token'
    )
  );
  process.exit(1);
} else if (typeof config.library === 'string') {
  switch (config.library) {
    case 'core':
    case '@spartacus/core':
      config.library = '@spartacus/core';
      break;
    case 'storefrontlib':
    case 'storefront':
    case '@spartacus/storefront':
    case '@spartacus/storefrontlib':
      config.library = '@spartacus/storefront';
      break;
    case 'styles':
    case '@spartacus/styles':
    case 'storefrontstyles':
      config.library = '@spartacus/styles';
      break;
    case 'assets':
    case '@spartacus/assets':
      config.library = '@spartacus/assets';
      break;
    case 'schematics':
    case '@spartacus/schematics':
      config.library = '@spartacus/schematics';
      break;
    case 'incubator':
    case '@spartacus/incubator':
      config.library = '@spartacus/incubator';
      break;
    default:
      config.library = undefined;
  }
}

run(config, new logging.NullLogger());
