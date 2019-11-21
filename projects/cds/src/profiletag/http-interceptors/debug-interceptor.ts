import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ProfileTagInjector } from '../profile-tag.injector';

@Injectable({ providedIn: 'root' })
export class DebugInterceptor implements HttpInterceptor {
  constructor(private profileTagTracker: ProfileTagInjector) {}
  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    console.log(`debug: ${this.profileTagTracker.profileTagDebug}`);
    const cdsHeaders = request.headers.set(
      'X-Profile-Tag-Debug',
      this.profileTagTracker.profileTagDebug.toString()
    );
    const cdsRequest = request.clone({ headers: cdsHeaders });
    return next.handle(cdsRequest);
    // return this.profileTagTracker.profileTagDebug$.pipe(
    //   switchMap(profileTagDebug => {
    //     console.log(`debug: ${profileTagDebug}`);
    //     const cdsHeaders = request.headers.set(
    //       'X-Profile-Tag-Debug',
    //       profileTagDebug.toString()
    //     );
    //     const cdsRequest = request.clone({ headers: cdsHeaders });
    //     return next.handle(cdsRequest);
    //   })
    // );
  }
}
