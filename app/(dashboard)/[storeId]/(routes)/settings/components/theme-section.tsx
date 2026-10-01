import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";

/**
 * Informational only, on purpose: Release 1 ships exactly one Storefront
 * theme, so "Default" / "Active" is a static fact of this release, not a
 * stored preference. There is nothing to persist, select, or submit here —
 * no form, no API call, no schema field. See decisions/DECISIONS.md in
 * storvia-ai-context for the durable "one theme for Release 1" decision.
 */
export function ThemeSection() {
    return (
        <div className="space-y-4">
            <Heading
                title="Storefront theme"
                description="The visual design your customers see on your Storefront"
            />
            <Separator />
            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                    <div>
                        <CardTitle>Default</CardTitle>
                        <CardDescription>
                            Storvia&apos;s current Storefront theme
                        </CardDescription>
                    </div>
                    <Badge className="shrink-0">Active</Badge>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Your Storefront is using the Default theme. There is nothing
                        you need to configure right now. More themes may become
                        available in future releases.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
