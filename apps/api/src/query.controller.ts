import { Body, Controller, Inject, Post } from "@nestjs/common";
import { QueryRequestDto } from "./query-request.dto";
import { QueryService } from "./query.service";
import { createRequestValidationPipe } from "./request-validation.pipe";

@Controller("query")
export class QueryController {
  constructor(@Inject(QueryService) private readonly queryService: QueryService) {}

  @Post()
  query(@Body(createRequestValidationPipe(QueryRequestDto)) body: QueryRequestDto) {
    return this.queryService.query(body.question);
  }
}
