import { getThemeInitializationScript } from "@/lib/theme/theme";

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: getThemeInitializationScript() }} />;
}
