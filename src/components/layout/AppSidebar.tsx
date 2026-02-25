import {
  LayoutDashboard,
  GitBranch,
  Users,
  Bell,
  Shield,
  ChevronRight,
  Zap,
  Package,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useUnmappedProducts } from "@/hooks/useProductCatalog";

function UnmappedCount() {
  const { data: unmapped = [] } = useUnmappedProducts();
  if (unmapped.length === 0) return null;
  return (
    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-amber-500 text-white border-0">
      {unmapped.length}
    </Badge>
  );
}

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Campanhas", url: "/campaigns", icon: Zap },
  { title: "Funis", url: "/funnels", icon: GitBranch },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Produtos", url: "/products", icon: Package },
  { title: "Insights", url: "/insights", icon: Bell },
];

export function AppSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shrink-0">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="text-base font-bold tracking-widest text-foreground uppercase">
                SENTINEL
              </span>
              <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
                Funnel Intelligence
              </p>
            </div>
          )}
          <div className="ml-auto shrink-0">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] tracking-widest uppercase text-muted-foreground px-3 mb-1">
              Navegação
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.url === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                          isActive
                            ? "bg-primary/15 text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1">{item.title}</span>
                            {item.title === "Insights" && (
                              <Badge className="text-[9px] px-1.5 py-0 h-4 bg-sentinel-critical text-white border-0">
                                2
                              </Badge>
                            )}
                            {item.title === "Produtos" && (
                              <UnmappedCount />
                            )}
                            {isActive && <ChevronRight className="w-3 h-3 opacity-50" />}
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 border-t border-sidebar-border">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-sentinel-success animate-pulse-glow shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">Workspace Alpha</p>
              <p className="text-[10px] text-muted-foreground truncate">3 funis ativos</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-2 h-2 rounded-full bg-sentinel-success animate-pulse-glow" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
