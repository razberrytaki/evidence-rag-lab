import { Body, Controller, Inject, Post } from "@nestjs/common";
import { createRequestValidationPipe } from "../common/request-validation.pipe";
import { QueryRequestDto } from "./dto/query-request.dto";
import { QueryService } from "./query.service";

@Controller("query")
export class QueryController {
  constructor(@Inject(QueryService) private readonly queryService: QueryService) {}

  @Post()
  query(@Body(createRequestValidationPipe(QueryRequestDto)) body: QueryRequestDto) {
    return this.queryService.query(body.question);
  }
}
