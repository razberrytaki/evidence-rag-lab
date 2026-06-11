import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppConfigService } from "./app.config";
import { IS_PUBLIC_ROUTE } from "./public-route.decorator";

@Injectable()
export class ApiAuthGuard implements CanActivate {
  constructor(
    @Inject(AppConfigService)
    private readonly config: AppConfigService,
    @Inject(Reflector)
    private readonly reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.config.apiAuthToken) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const authorization = request.headers.authorization;
    const token = Array.isArray(authorization) ? authorization[0] : authorization;

    if (token === `Bearer ${this.config.apiAuthToken}`) {
      return true;
    }

    throw new UnauthorizedException("missing or invalid API bearer token");
  }
}
