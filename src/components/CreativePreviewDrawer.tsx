import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ExternalLink, Image, Video, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreativeAsset {
  id: string;
  asset_url: string;
  thumbnail_url: string | null;
  asset_type: string;
  provider: string;
  external_asset_id: string | null;
}

interface Creative {
  id: string;
  name: string;
  assets: CreativeAsset[];
}

interface Props {
  campaignId: string | null;
  campaignName: string | null;
  open: boolean;
  onClose: () => void;
}

export function CreativePreviewDrawer({ campaignId, campaignName, open, onClose }: Props) {
  const { currentWorkspace } = useWorkspace();
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !campaignId || !currentWorkspace?.id) return;

    const fetch = async () => {
      setLoading(true);
      setCreatives([]);
      try {
        const { data: creativesData } = await supabase
          .from("creatives")
          .select("id, name")
          .eq("campaign_id", campaignId)
          .eq("workspace_id", currentWorkspace.id)
          .limit(20);

        if (!creativesData?.length) {
          setLoading(false);
          return;
        }

        const creativeIds = creativesData.map((c) => c.id);
        const { data: assetsData } = await supabase
          .from("creative_assets")
          .select("id, asset_url, thumbnail_url, asset_type, provider, external_asset_id, creative_id")
          .in("creative_id", creativeIds)
          .eq("workspace_id", currentWorkspace.id);

        const assetsByCreative = new Map<string, CreativeAsset[]>();
        for (const asset of assetsData ?? []) {
          const list = assetsByCreative.get(asset.creative_id!) ?? [];
          list.push(asset);
          assetsByCreative.set(asset.creative_id!, list);
        }

        setCreatives(
          creativesData.map((c) => ({
            id: c.id,
            name: c.name,
            assets: assetsByCreative.get(c.id) ?? [],
          }))
        );
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [open, campaignId, currentWorkspace?.id]);

  const totalAssets = creatives.reduce((sum, c) => sum + c.assets.length, 0);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-sm font-bold leading-tight">
            {campaignName ?? "Creatividades"}
          </SheetTitle>
          {!loading && totalAssets > 0 && (
            <p className="text-[10px] text-muted-foreground">{creatives.length} creativo(s) · {totalAssets} asset(s)</p>
          )}
        </SheetHeader>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : creatives.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Image className="h-10 w-10 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">Sin creatividades vinculadas a esta campaña.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {creatives.map((creative) => (
              <div key={creative.id} className="space-y-2">
                <p className="text-xs font-semibold truncate">{creative.name}</p>
                {creative.assets.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground">Sin assets.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {creative.assets.map((asset) => (
                      <AssetCard key={asset.id} asset={asset} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AssetCard({ asset }: { asset: CreativeAsset }) {
  const isVideo = asset.asset_type === "video";
  const preview = asset.thumbnail_url ?? asset.asset_url;

  return (
    <div className="relative rounded-lg overflow-hidden border border-border bg-muted/30 group">
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt=""
            className="w-full aspect-square object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Play className="h-8 w-8 text-white drop-shadow" />
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-square flex items-center justify-center bg-muted">
          {isVideo ? <Video className="h-8 w-8 text-muted-foreground/40" /> : <Image className="h-8 w-8 text-muted-foreground/40" />}
        </div>
      )}
      <div className="p-1.5 flex items-center justify-between gap-1">
        <Badge variant="secondary" className={cn("text-[9px] px-1 py-0", isVideo ? "bg-info/10 text-info" : "bg-muted")}>
          {isVideo ? "Video" : "Imagen"}
        </Badge>
        <a
          href={asset.asset_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
