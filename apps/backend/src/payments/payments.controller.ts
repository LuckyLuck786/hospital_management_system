import { Controller, Get, Post, Body, Param, Req, Headers, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Payments')
@Controller('payments')
@ApiBearerAuth()
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get('config')
  @ApiOperation({ summary: 'Whether online payments are configured (and public key id)' })
  async config() {
    return this.paymentsService.config();
  }

  @Post('orders/:invoiceId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.ACCOUNTANT,
    UserRole.PATIENT,
  )
  @ApiOperation({ summary: 'Create a Razorpay order for an invoice' })
  async createOrder(@Param('invoiceId') invoiceId: string, @CurrentUser() user: any) {
    return this.paymentsService.createOrder(user, invoiceId);
  }

  @Post('verify-payment')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.ACCOUNTANT,
    UserRole.PATIENT,
  )
  @ApiOperation({ summary: 'Verify the Standard Checkout signature and mark the invoice paid' })
  async verifyPayment(
    @Body() body: { orderId: string; paymentId: string; signature: string },
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.verifyPayment(user, body);
  }

  @Public()
  @Post('webhook/razorpay')
  @ApiOperation({ summary: 'Razorpay webhook (signature-verified) — do not call manually' })
  async webhook(
    @Req() req: Request,
    @Headers('x-razorpay-signature') signature?: string,
  ) {
    const raw = (req as any).rawBody;
    if (!raw || !Buffer.isBuffer(raw) || !raw.length) {
      throw new BadRequestException('Raw body required');
    }
    return this.paymentsService.handleWebhook(raw, signature || '');
  }
}
