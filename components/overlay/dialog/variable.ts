export const DIALOG_STYLES = {
  overlay: "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-overlay",
  content: "bg-card data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border border-border-default p-6 shadow-lg duration-200 outline-none sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto scrollbar-hide",
  close: "ring-offset-background focus:ring-primary data-[state=open]:bg-bg-neutral data-[state=open]:text-text-caption absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  header: "flex flex-col gap-2 text-center sm:text-left",
  footer: "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
  title: "text-lg leading-none font-semibold",
  description: "text-text-caption text-sm",
}
