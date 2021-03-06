import * as path from 'path';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';

const collectionPath = path.join(__dirname, '../collection.json');

// tslint:disable:max-line-length
describe('Spartacus Schematics: add-pwa', () => {
  const schematicRunner = new SchematicTestRunner('schematics', collectionPath);

  let appTree: UnitTestTree;

  const workspaceOptions: any = {
    name: 'workspace',
    newProjectRoot: 'projects',
    version: '0.5.0',
  };

  const appOptions: any = {
    name: 'schematics-test',
    inlineStyle: false,
    inlineTemplate: false,
    routing: false,
    style: 'scss',
    skipTests: false,
  };

  const defaultOptions = {
    project: 'schematics-test',
    target: 'build',
    configuration: 'production',
  };

  beforeEach(async () => {
    appTree = await schematicRunner
      .runExternalSchematicAsync(
        '@schematics/angular',
        'workspace',
        workspaceOptions
      )
      .toPromise();
    appTree = await schematicRunner
      .runExternalSchematicAsync(
        '@schematics/angular',
        'application',
        appOptions,
        appTree
      )
      .toPromise();
  });

  it('Add PWA/ServiceWorker support for your project', async () => {
    const tree = await schematicRunner
      .runSchematicAsync('add-pwa', defaultOptions, appTree)
      .toPromise();
    const packageJson = tree.readContent('/package.json');
    const packageObj = JSON.parse(packageJson);
    const depPackageList = Object.keys(packageObj.dependencies);
    expect(depPackageList.includes('@angular/service-worker')).toBe(true);
    expect(
      tree.files.includes('/projects/schematics-test/src/manifest.webmanifest')
    ).toBe(true);
    expect(
      tree.files.includes(
        '/projects/schematics-test/src/assets/icons/icon-96x96.png'
      )
    ).toBe(true);
  });
});
