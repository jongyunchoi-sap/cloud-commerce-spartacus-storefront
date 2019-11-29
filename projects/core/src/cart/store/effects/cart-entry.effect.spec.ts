import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { cold, hot } from 'jasmine-marbles';
import { Observable, of } from 'rxjs';
import { OccConfig } from '../../../occ/index';
import { CartEntryConnector } from '../../connectors/entry/cart-entry.connector';
import * as DeprecatedCartActions from '../actions/cart.action';
import { CartActions } from '../actions/index';
import * as fromEffects from './cart-entry.effect';

import createSpy = jasmine.createSpy;

const MockOccModuleConfig: OccConfig = {
  backend: {
    occ: {
      baseUrl: '',
      prefix: '',
    },
  },
};

class MockCartEntryConnector {
  add = createSpy().and.returnValue(of({ entry: 'testEntry' }));
  remove = createSpy().and.returnValue(of({}));
  update = createSpy().and.returnValue(of({}));
}

describe('Cart effect', () => {
  let entryEffects: fromEffects.CartEntryEffects;
  let actions$: Observable<Action>;
  let cartEntryConnector: CartEntryConnector;

  const userId = 'testUserId';
  const cartId = 'testCartId';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: CartEntryConnector, useClass: MockCartEntryConnector },
        fromEffects.CartEntryEffects,
        { provide: OccConfig, useValue: MockOccModuleConfig },
        provideMockActions(() => actions$),
      ],
    });

    entryEffects = TestBed.get(fromEffects.CartEntryEffects as Type<
      fromEffects.CartEntryEffects
    >);
    cartEntryConnector = TestBed.get(CartEntryConnector as Type<
      CartEntryConnector
    >);
  });

  describe('addEntry$', () => {
    it('should add an entry', () => {
      const action = new CartActions.CartAddEntry({
        userId: userId,
        cartId: cartId,
        productCode: 'testProductCode',
        quantity: 1,
      });
      const completion = new CartActions.CartAddEntrySuccess({
        entry: 'testEntry',
        userId,
        cartId,
      });

      actions$ = hot('-a', { a: action });
      const expected = cold('-b', { b: completion });

      expect(entryEffects.addEntry$).toBeObservable(expected);
    });
  });

  describe('addEntries$', () => {
    it('should add multiple entries', () => {
      const action = new CartActions.CartAddEntries({
        userId,
        cartId,
        products: [
          { productCode: 'testProductCode', quantity: 1 },
          { productCode: 'testProductCode2', quantity: 2 },
        ],
      });
      const cartAddEntriesSuccessCompletion = new CartActions.CartAddEntriesSuccess(
        {}
      );
      const loadCartCompletion = new DeprecatedCartActions.LoadCart({
        userId,
        cartId,
        extraData: {
          addEntries: true,
        },
      });

      actions$ = hot('-a', { a: action });
      const expected = cold('-(bc)', {
        b: cartAddEntriesSuccessCompletion,
        c: loadCartCompletion,
      });
      expect(entryEffects.addEntries$).toBeObservable(expected);
      expect(cartEntryConnector.add).toHaveBeenCalledTimes(2);
    });
  });

  describe('removeEntry$', () => {
    it('should remove an entry', () => {
      const action = new CartActions.CartRemoveEntry({
        userId: userId,
        cartId: cartId,
        entry: 'testEntryNumber',
      });
      const completion = new CartActions.CartRemoveEntrySuccess({
        userId,
        cartId,
      });

      actions$ = hot('-a', { a: action });
      const expected = cold('-b', { b: completion });

      expect(entryEffects.removeEntry$).toBeObservable(expected);
    });
  });

  describe('updateEntry$', () => {
    it('should update an entry', () => {
      const action = new CartActions.CartUpdateEntry({
        userId: userId,
        cartId: cartId,
        entry: 'testEntryNumber',
        qty: 1,
      });
      const completion = new CartActions.CartUpdateEntrySuccess({
        userId,
        cartId,
      });

      actions$ = hot('-a', { a: action });
      const expected = cold('-b', { b: completion });

      expect(entryEffects.updateEntry$).toBeObservable(expected);
    });
  });
});
