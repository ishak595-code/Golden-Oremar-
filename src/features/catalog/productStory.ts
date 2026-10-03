/**
 * Product story ("Ürünün Hikâyesi") length limit, shared by the super admin
 * official store editor and the producer product editor. The database enforces
 * the same limit (products_story_length_check, migration
 * 20261003030000_product_story_limit_1500_v1).
 */
export const PRODUCT_STORY_MAX_LENGTH = 1500;

export function productStoryCounter(value: string) {
  return `${value.trim().length.toLocaleString('tr-TR')} / ${PRODUCT_STORY_MAX_LENGTH.toLocaleString('tr-TR')} karakter`;
}
