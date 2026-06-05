import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AppUser } from '../auth/app-user';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AppUser) {
    return this.users.getMe(user);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AppUser, @Body() body: Record<string, string>) {
    return this.users.updateMe(user, body);
  }

  @Get('staff')
  listStaff(@CurrentUser() user: AppUser) {
    return this.users.listStaff(user);
  }

  @Post('staff')
  inviteStaff(@CurrentUser() user: AppUser, @Body() body: { nome: string; email: string; role: string; especialidade?: string; crm?: string }) {
    return this.users.inviteStaff(user, body);
  }
}
