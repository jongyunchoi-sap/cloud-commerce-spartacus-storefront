import { Injectable } from '@angular/core';
import { CanActivate, RouterStateSnapshot, UrlTree } from '@angular/router';
import {
  CmsActivatedRouteSnapshot,
  CmsService,
  Page,
  PageContext,
  PageType,
  ProtectedRoutesGuard,
  RoutingService,
  SemanticPathService,
} from '@spartacus/core';
import { Observable, of } from 'rxjs';
import {
  filter,
  first,
  map,
  switchMap,
  take,
  tap,
  withLatestFrom,
} from 'rxjs/operators';
import { CmsGuardsService } from '../services/cms-guards.service';
import { CmsI18nService } from '../services/cms-i18n.service';
import { CmsRoutesService } from '../services/cms-routes.service';

@Injectable({
  providedIn: 'root',
})
export class CmsPageGuard implements CanActivate {
  static guardName = 'CmsPageGuard';

  constructor(
    routingService: RoutingService,
    cmsService: CmsService,
    cmsRoutes: CmsRoutesService,
    cmsI18n: CmsI18nService,
    cmsGuards: CmsGuardsService,
    semanticPathService: SemanticPathService,
    protectedRoutesGuard: ProtectedRoutesGuard // tslint:disable-line
  );

  /**
   * @deprecated since version 1.2.0
   * Use constructor with more dependencies and make them all required.
   *
   * TODO(issue:4646) deprecated since version 1.2.0
   */
  constructor(
    routingService: RoutingService,
    cmsService: CmsService,
    cmsRoutes: CmsRoutesService,
    cmsI18n: CmsI18nService,
    cmsGuards: CmsGuardsService,
    semanticPathService: SemanticPathService
  );
  constructor(
    // expose as `protected` only services from public API:
    protected routingService: RoutingService,
    protected cmsService: CmsService,
    private cmsRoutes: CmsRoutesService,
    private cmsI18n: CmsI18nService,
    private cmsGuards: CmsGuardsService,
    protected semanticPathService: SemanticPathService,
    protected protectedRoutesGuard?: ProtectedRoutesGuard
  ) {}

  canActivate(
    route: CmsActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    /**
     * TODO(issue:4646) Expect that `ProtectedRoutesGuard` dependency is required (remove `if` logic)
     */
    return this.protectedRoutesGuard
      ? this.protectedRoutesGuard
          .canActivate(route)
          .pipe(
            switchMap((result) =>
              result ? this.getCmsPage(route, state) : of(result)
            )
          )
      : this.getCmsPage(route, state);
  }

  private getCmsPage(
    route: CmsActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    return this.routingService.getNextPageContext().pipe(
      switchMap((pageContext) =>
        this.cmsService
          .getPage(pageContext, this.cmsGuards.shouldForceRefreshPage())
          .pipe(first(), withLatestFrom(of(pageContext)))
      ),
      switchMap(([pageData, pageContext]) =>
        pageData
          ? this.resolveCmsPageLogic(pageContext, pageData, route, state)
          : this.handleNotFoundPage(pageContext, route, state)
      )
    );
  }

  private resolveCmsPageLogic(
    pageContext: PageContext,
    pageData: Page,
    route: CmsActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    return this.cmsService.getPageComponentTypes(pageContext).pipe(
      take(1),
      switchMap((componentTypes) =>
        this.cmsGuards
          .cmsPageCanActivate(componentTypes, route, state)
          .pipe(withLatestFrom(of(componentTypes)))
      ),
      tap(([canActivate, componentTypes]) => {
        if (canActivate === true) {
          this.cmsI18n.loadChunksForComponents(componentTypes);
        }
      }),
      map(([canActivate, componentTypes]) => {
        const pageLabel = pageData.label || pageContext.id; // for content pages the page label returned from backend can be different than ID initially assumed from route
        if (
          canActivate === true &&
          !route.data.cxCmsRouteContext &&
          !this.cmsRoutes.cmsRouteExist(pageLabel)
        ) {
          return this.cmsRoutes.handleCmsRoutesInGuard(
            pageContext,
            componentTypes,
            state.url,
            pageLabel
          );
        }
        return canActivate;
      })
    );
  }

  private handleNotFoundPage(
    pageContext: PageContext,
    route: CmsActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    const notFoundCmsPageContext: PageContext = {
      type: PageType.CONTENT_PAGE,
      id: this.semanticPathService.get('notFound'),
    };
    return this.cmsService.getPage(notFoundCmsPageContext).pipe(
      switchMap((notFoundPage) => {
        if (notFoundPage) {
          return this.cmsService.getPageIndex(notFoundCmsPageContext).pipe(
            tap((notFoundIndex) => {
              this.cmsService.setPageFailIndex(pageContext, notFoundIndex);
            }),
            switchMap((notFoundIndex) =>
              this.cmsService.getPageIndex(pageContext).pipe(
                // we have to wait for page index update
                filter((index) => index === notFoundIndex)
              )
            ),
            switchMap(() =>
              this.resolveCmsPageLogic(pageContext, notFoundPage, route, state)
            )
          );
        }
        return of(false);
      })
    );
  }
}
