import { Injectable, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { allowedOrigins } from '../common/cors';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: allowedOrigins(),
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private jwtService: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization || '').replace('Bearer ', '');
      const payload = this.jwtService.verify(token) as { sub: string; hospitalId?: string; role?: string };

      // Every user gets a private room; staff also join their hospital's room.
      void client.join(`user:${payload.sub}`);
      if (payload.hospitalId) void client.join(`hospital:${payload.hospitalId}`);
      client.data.userId = payload.sub;
    } catch {
      this.logger.warn(`Rejecting socket ${client.id} — invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect() {
    // rooms are cleaned up by socket.io automatically
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToHospital(hospitalId: string, event: string, data: unknown) {
    this.server.to(`hospital:${hospitalId}`).emit(event, data);
  }
}
