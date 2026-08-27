import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CRAWLER_FIXTURES, type CrawlerFixtureName } from '../crawler.types';

export class ParseCrawlerFixtureDto {
  @ApiProperty({ enum: CRAWLER_FIXTURES })
  @IsIn([...CRAWLER_FIXTURES])
  fixture!: CrawlerFixtureName;
}

export class EvaluateCrawlerUrlDto {
  @ApiProperty({ example: 'https://www.books.am/am/example-book.html' })
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2048)
  url!: string;
}

export class ObserveUpstreamStatusDto {
  @ApiProperty({ minimum: 100, maximum: 599 })
  @IsInt()
  @Min(100)
  @Max(599)
  status!: number;

  @ApiProperty()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  sourceUrl!: string;
}

export class ResumeCrawlerDto {
  @ApiProperty({ minLength: 8, maxLength: 300 })
  @IsString()
  @MinLength(8)
  @MaxLength(300)
  reason!: string;
}
