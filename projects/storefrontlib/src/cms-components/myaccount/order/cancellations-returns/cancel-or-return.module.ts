import { NgModule } from '@angular/core';
import { CancelOrderModule } from './cancel-order/cancel-order.module';
import { ReturnOrderModule } from './return-order/return-order.module';
import { ReturnOrderConfirmationModule } from './return-order-confirmation/return-order-confirmation.module';
import { OrderCancelOrReturnService } from './cancel-or-return.service';

@NgModule({
  imports: [
    CancelOrderModule,
    ReturnOrderModule,
    ReturnOrderConfirmationModule,
  ],
  providers: [OrderCancelOrReturnService],
})
export class OrderCancelOrReturnModule {}
