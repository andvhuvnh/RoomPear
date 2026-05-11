import type { StyleProp, TextStyle } from 'react-native';

/** Keys match `useFonts` / `loadAsync` in App.tsx */
export const fonts = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_500Medium',
  semiBold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extraBold: 'Nunito_800ExtraBold',
} as const;

export const serifFonts = {
  regular: 'Lora_400Regular',
  italic: 'Lora_400Regular_Italic',
  bold: 'Lora_700Bold',
} as const;

/** Prepends app font; later entries in the style array override `fontFamily` if set. */
export function withAppFontFamily(style: StyleProp<TextStyle> | undefined): StyleProp<TextStyle> {
  const base: TextStyle = { fontFamily: fonts.regular };
  if (style == null) return base;
  if (Array.isArray(style)) return [base, ...style];
  return [base, style];
}
