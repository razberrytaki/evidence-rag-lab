import { Controller, Get } from "@nestjs/common";

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
