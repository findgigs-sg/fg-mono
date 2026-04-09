import type { VariantProps } from "class-variance-authority";
import type { Role } from "react-native";
import * as React from "react";
import { Platform, Text as RNText } from "react-native";
import * as Slot from "@rn-primitives/slot";
import { cva } from "class-variance-authority";

import { cn } from "~/lib/utils";

/**
 * Maps a Tailwind font-weight class (or its absence) to the matching
 * Inter font-family variant loaded in `_layout.tsx`. NativeWind v5 preview
 * + react-native ignore `font-weight` for custom font families on iOS, so
 * we set the font family explicitly per weight.
 */
function interFontFamilyForClassName(className: string): string {
  if (/\bfont-extrabold\b/.test(className)) return "Inter_800ExtraBold";
  if (/\bfont-bold\b/.test(className)) return "Inter_700Bold";
  if (/\bfont-semibold\b/.test(className)) return "Inter_600SemiBold";
  if (/\bfont-medium\b/.test(className)) return "Inter_500Medium";
  return "Inter_400Regular";
}

const textVariants = cva(
  cn(
    "text-foreground text-base",
    Platform.select({
      web: "select-text",
    }),
  ),
  {
    variants: {
      variant: {
        default: "",
        h1: cn(
          "text-center text-4xl font-extrabold tracking-tight",
          Platform.select({ web: "scroll-m-20 text-balance" }),
        ),
        h2: cn(
          "border-border border-b pb-2 text-3xl font-semibold tracking-tight",
          Platform.select({ web: "scroll-m-20 first:mt-0" }),
        ),
        h3: cn(
          "text-2xl font-semibold tracking-tight",
          Platform.select({ web: "scroll-m-20" }),
        ),
        h4: cn(
          "text-xl font-semibold tracking-tight",
          Platform.select({ web: "scroll-m-20" }),
        ),
        p: "mt-3 leading-7 sm:mt-6",
        blockquote: "mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6",
        code: cn(
          "bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
        ),
        lead: "text-muted-foreground text-xl",
        large: "text-lg font-semibold",
        small: "text-sm leading-none font-medium",
        muted: "text-muted-foreground text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps["variant"]>;

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  blockquote: Platform.select({ web: "blockquote" as Role }),
  code: Platform.select({ web: "code" as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  h1: "1",
  h2: "2",
  h3: "3",
  h4: "4",
};

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
  className,
  asChild = false,
  variant = "default",
  style,
  ...props
}: React.ComponentProps<typeof RNText> &
  TextVariantProps & {
    asChild?: boolean;
  }) {
  const textClass = React.useContext(TextClassContext);
  const Component = asChild ? Slot.Text : RNText;
  const merged = cn(textVariants({ variant }), textClass, className);
  const fontFamily = interFontFamilyForClassName(merged);
  return (
    <Component
      className={merged}
      style={[{ fontFamily }, style]}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      {...props}
    />
  );
}

export { Text, TextClassContext };
