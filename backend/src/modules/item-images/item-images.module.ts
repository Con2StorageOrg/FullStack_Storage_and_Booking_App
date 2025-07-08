import { Module } from "@nestjs/common";
import { ItemImagesController } from "./item-images.controller";
import { ItemImagesService } from "./item-images.service";
import { SupabaseModule } from "../supabase/supabase.module";

@Module({
  imports: [SupabaseModule],
  controllers: [ItemImagesController],
  providers: [ItemImagesService],
})
export class ItemImagesModule {}
