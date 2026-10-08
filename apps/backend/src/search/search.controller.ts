import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Search')
@Controller('search')
@ApiBearerAuth()
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Global search across patients, doctors, medicines, appointments' })
  async search(
    @TenantId() hospitalId: string,
    @CurrentUser() user: any,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.search(hospitalId, user, q || '', parseInt(limit) || 8);
  }
}
