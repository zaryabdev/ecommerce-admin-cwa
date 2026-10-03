"use client";

import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";

import { columns, OrderColumn } from "./columns";
import { OrderMobileRow } from "./mobile-list";

interface OrderClientProps {
    data: OrderColumn[];
}

export const OrderClient: React.FC<OrderClientProps> = ({ data }) => {
    return (
        <>
            <Heading
                title={`Orders (${data.length})`}
                description="Manage orders for your store"
            />
            <Separator />
            <DataTable
                searchKey="trackingId"
                columns={columns}
                data={data}
                mobileRow={(order) => <OrderMobileRow order={order} />}
            />
        </>
    );
};
