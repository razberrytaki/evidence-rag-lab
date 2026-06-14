import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PublicRoute } from "../security/public-route.decorator";

@PublicRoute()
@SkipThrottle()
@Controller("health")
export class HealthController {
  @Get()
  getHealth(): { ok: true; service: string } {
    return {
      ok: true,
      service: "evidence-rag-lab-api"
    };
  }
}
