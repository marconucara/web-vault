declare module 'virtual:web-vault-content' {
  const content: any;
  export default content;
}

declare module 'virtual:web-vault-icons' {
  import type { ComponentType } from 'react';
  const icons: Record<string, ComponentType<any>>;
  export default icons;
}

interface Window {
  __results?: unknown;
  __done?: boolean;
}
