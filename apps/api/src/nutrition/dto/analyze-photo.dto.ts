import { IsIn, IsString } from 'class-validator';

export class AnalyzePhotoDto {
  /** Imagem em base64 (sem o prefixo data:...). */
  @IsString()
  imageBase64!: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  mediaType!: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
}
