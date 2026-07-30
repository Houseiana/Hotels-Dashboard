import {
  BedDouble,
  CalendarRange,
  Hotel,
  LayoutDashboard,
  Settings,
  Star,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  href: string;
  /** Key under the `nav` namespace. */
  labelKey: string;
  icon: LucideIcon;
  /** Key under `nav` for the group heading this item opens. */
  sectionKey?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/', labelKey: 'overview', icon: LayoutDashboard },
  { href: '/hotels', labelKey: 'hotels', icon: Hotel, sectionKey: 'sectionManage' },
  { href: '/bookings', labelKey: 'bookings', icon: BedDouble },
  { href: '/pricing', labelKey: 'pricing', icon: CalendarRange, sectionKey: 'sectionRevenue' },
  { href: '/reviews', labelKey: 'reviews', icon: Star },
  { href: '/settings', labelKey: 'settings', icon: Settings, sectionKey: 'sectionAccount' },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
