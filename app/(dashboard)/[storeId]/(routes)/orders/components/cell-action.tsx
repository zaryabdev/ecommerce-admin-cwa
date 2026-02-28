"use client";

import axios from "axios";
import { MoreHorizontal } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CellActionProps {
    data: {
        id: string;
        status: string;
    };
}

export const CellAction: React.FC<CellActionProps> = ({ data }) => {
    const router = useRouter();
    const params = useParams();

    const onStatusChange = async (status: string) => {
        try {
            await axios.patch(`/api/${params.storeId}/orders/${data.id}`, {
                status,
            });

            toast.success("Order updated.");
            router.refresh();
        } catch (error) {
            toast.error("Something went wrong.");
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="p-2">
                    <MoreHorizontal className="w-4 h-4" />
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onStatusChange("CONFIRMED")}>
                    Mark Confirmed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange("DELIVERED")}>
                    Mark Delivered
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange("CANCELED")}>
                    Cancel Order
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
