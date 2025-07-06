'use client'

import { usePathname } from "next/navigation"
import Navbar from "./navbar";

export default function ConditionalNavbar() {
    const pathname = usePathname();

    const hiddenPaths = ['/', '/login', '/signup', '/invite'];
    const isHidden = hiddenPaths.includes(pathname);

    return !isHidden ? <Navbar /> : null;
}