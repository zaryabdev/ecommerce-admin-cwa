"use client";

import axios from "axios";
import { MoreHorizontal } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { OrderColumn } from "./columns";
import OrderDetailsModal from "./order-details-modal";

interface CellActionProps {
    data: OrderColumn;
}

// Mirrors the transition matrix enforced server-side in
// app/api/[storeId]/orders/[orderId]/route.ts — keeps the dropdown from
// offering an action the API would now reject as an invalid transition.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ["CONFIRMED", "CANCELED"],
    CONFIRMED: ["DELIVERED", "CANCELED"],
    CANCELED: ["CONFIRMED"],
    DELIVERED: [],
};

export const CellAction: React.FC<CellActionProps> = ({ data }) => {
    const router = useRouter();
    const params = useParams();

    const [openDetails, setOpenDetails] = useState(false);

    const allowedTargets = ALLOWED_TRANSITIONS[data.status] ?? [];

    const onStatusChange = useCallback(
        async (status: string) => {
            try {
                await axios.patch(`/api/${params.storeId}/orders/${data.id}`, {
                    status,
                });
                toast.success("Order updated.");
                router.refresh();
            } catch {
                toast.error("Something went wrong.");
            }
        },
        [data.id, params.storeId, router],
    );

    return (
        <>
            <OrderDetailsModal
                open={openDetails}
                onClose={() => setOpenDetails(false)}
                order={data}
            />

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="p-2">
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setOpenDetails(true)}>
                        View details
                    </DropdownMenuItem>

                    {allowedTargets.includes("CONFIRMED") && (
                        <DropdownMenuItem
                            onClick={() => onStatusChange("CONFIRMED")}
                        >
                            Mark Confirmed
                        </DropdownMenuItem>
                    )}
                    {allowedTargets.includes("DELIVERED") && (
                        <DropdownMenuItem
                            onClick={() => onStatusChange("DELIVERED")}
                        >
                            Mark Delivered
                        </DropdownMenuItem>
                    )}
                    {allowedTargets.includes("CANCELED") && (
                        <DropdownMenuItem
                            onClick={() => onStatusChange("CANCELED")}
                        >
                            Cancel Order
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
};
