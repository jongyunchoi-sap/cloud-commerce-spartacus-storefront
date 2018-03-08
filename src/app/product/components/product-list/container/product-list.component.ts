import {
  Component,
  Input,
  OnInit,
  OnChanges,
  ViewChild,
  ChangeDetectionStrategy
} from '@angular/core';
import { MatSidenav } from '@angular/material';

import { Store } from '@ngrx/store';
import * as fromProductStore from '../../../store';
import { tap } from 'rxjs/operators';
import { SearchConfig } from '../../../search-config';

@Component({
  selector: 'y-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductListComponent implements OnChanges, OnInit {
  model$;

  @ViewChild('sidenav') sidenav: MatSidenav;

  grid: any;

  @Input() gridMode: String;
  @Input() query;
  @Input() categoryCode;
  @Input() brandCode;

  subject;
  config;

  isFacetPanelOpen = true;

  constructor(protected store: Store<fromProductStore.ProductsState>) {}

  ngOnInit() {
    this.grid = {
      mode: this.gridMode
    };

    this.model$ = this.store.select(fromProductStore.getSearchResults).pipe(
      tap(results => {
        if (Object.keys(results).length === 0) {
          if (this.query) {
            this.search(this.query);
          }
        }
      })
    );
  }

  ngOnChanges() {
    let categorySearch;

    if (this.categoryCode) {
      categorySearch = ':relevance:category:' + this.categoryCode;
    }
    if (this.brandCode) {
      categorySearch = ':relevance:brand:' + this.brandCode;
    }

    if (categorySearch !== undefined) {
      this.search(categorySearch);
    }
  }

  toggleSidenav() {
    this.sidenav.toggle();
  }

  onFilter(query: string) {
    this.search(query);
  }

  protected search(query) {
    this.store.dispatch(
      new fromProductStore.SearchProducts({
        queryText: query,
        searchConfig: new SearchConfig(10)
      })
    );
  }
}
