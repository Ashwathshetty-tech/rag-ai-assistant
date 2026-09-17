import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { AiService } from './ai.service';

class QueryDto {
  @IsString()
  @MinLength(1)
  question: string;

  @IsOptional()
  @IsUUID()
  documentId?: string;
}

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('query')
  @HttpCode(HttpStatus.OK)
  async query(@Body() dto: QueryDto) {
    return this.aiService.query(dto.question, dto.documentId);
  }
}
