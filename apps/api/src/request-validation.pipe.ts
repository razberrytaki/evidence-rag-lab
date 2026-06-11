import { ValidationPipe, type Type, type ValidationPipeOptions } from "@nestjs/common";

const REQUEST_VALIDATION_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true
};

export function createRequestValidationPipe(expectedType?: Type<unknown>): ValidationPipe {
  return new ValidationPipe({
    ...REQUEST_VALIDATION_OPTIONS,
    ...(expectedType ? { expectedType } : {})
  });
}
