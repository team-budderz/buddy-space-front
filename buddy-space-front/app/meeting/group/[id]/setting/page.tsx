"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGroupPermissions } from "@/app/components/hooks/usegrouppermissiont";
import styles from "./setting.module.css";
import api from "@/app/api";
import { getAuthHeaders } from "@/app/api/auth";
import { createPortal } from "react-dom";

function ModalPortal({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted || !isOpen) return null

    return createPortal(children, document.body)
}

interface GroupData {
    id: number
    name: string
    description?: string
    coverImageUrl?: string
    coverAttachmentId?: number
    access: "PUBLIC" | "PRIVATE"
    type: "ONLINE" | "OFFLINE" | "HYBRID"
    interest: "HOBBY" | "FAMILY" | "SCHOOL" | "BUSINESS" | "EXERCISE" | "GAME" | "STUDY" | "FAN" | "OTHER"
    address?: string
    isNeighborhoodAuthRequired?: boolean
}

interface Member {
    id: number
    name: string
    role: "LEADER" | "SUB_LEADER" | "MEMBER"
    profileImageUrl?: string
    joinedAt: string
}

interface Permission {
    type: string
    role: "LEADER" | "SUB_LEADER" | "MEMBER"
}

interface ToastState {
    show: boolean
    message: string
    type: "success" | "error" | "warning" | "info"
}

interface ChatRoom {
    roomId: number;
    roomType: string;
}

type PermissionType =
    | "CREATE_POST"
    | "DELETE_POST"
    | "CREATE_SCHEDULE"
    | "DELETE_SCHEDULE"
    | "CREATE_MISSION"
    | "DELETE_MISSION"
    | "CREATE_VOTE"
    | "DELETE_VOTE"
    | "CREATE_DIRECT_CHAT_ROOM"
    | "CREATE_INVITE_LINK"
    | "INVITE_CHAT_PARTICIPANT"
    | "KICK_CHAT_PARTICIPANT"



export default function SettingPage() {
    const router = useRouter()
    const { id: groupId } = useParams()
    const [currentGroupData, setCurrentGroupData] = useState<GroupData | null>(null)
    const [currentMembers, setCurrentMembers] = useState<Member[]>([])
    const [currentPermissions, setCurrentPermissions] = useState<Permission[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [toast, setToast] = useState<ToastState>({ show: false, message: "", type: "success" })

    const [showGroupInfoModal, setShowGroupInfoModal] = useState(false)
    const [showDynamicModal, setShowDynamicModal] = useState(false)
    const [dynamicModalContent, setDynamicModalContent] = useState({
        title: "",
        body: "",
        footer: "",
    })

    const [groupName, setGroupName] = useState("")
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null)
    const [coverPreviewUrl, setCoverPreviewUrl] = useState("")
    const [isProcessing, setIsProcessing] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)

    const { isLoading: permsLoading, isLeader, hasPermission, refreshPermissions } = useGroupPermissions()

    // 채팅 동기화 
    const fetchChatRooms = async (): Promise<ChatRoom[]> => {
        const headers = await getAuthHeaders()
        const res = await api.get(`/group/${groupId}/chat/rooms/my`, { headers })
        return res.data.result ?? res.data.data
    }

    const findGroupRoomId = (rooms: ChatRoom[]): number | undefined => {
        return rooms.find((r) => r.roomType === "GROUP")?.roomId
    }

    const removeChatParticipant = async (roomId: number, userId: number) => {
        const headers = await getAuthHeaders()
        await api.delete(`/group/${groupId}/chat/rooms/${roomId}/participants/${userId}`, { headers })
    }

    const leaveChatRoom = async (roomId: number) => {
        const headers = await getAuthHeaders()
        await api.delete(`/group/${groupId}/chat/rooms/${roomId}/participants/me`, { headers })
    }

    useEffect(() => {
        if (!permsLoading && groupId) {
            initializeSettings();
        }
    }, [permsLoading, groupId]);



    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                closeModal()
            }
        }

        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [])

    const initializeSettings = async () => {
        setIsLoading(true)
        let data: GroupData | null = null

        try {
            if (!isLeader()) {
                showToast("리더만 설정 페이지에 접근할 수 있습니다.", "error");
                setCurrentGroupData(null);
                return;
            }

            const res = await api.get(`/groups/${groupId}`);
            setCurrentGroupData(res.data.result);

        } catch (err: any) {
            console.error("설정 초기화 실패:", err)
            showToast("설정 정보를 불러오는데 실패했습니다.", "error")
        } finally {
            setIsLoading(false)
            setCurrentGroupData(data)
        }
    }


    const showToast = (message: string, type: ToastState["type"] = "success") => {
        setToast({ show: true, message, type })
        setTimeout(() => {
            setToast((prev) => ({ ...prev, show: false }))
        }, 3000)
    }

    const closeModal = () => {
        setShowGroupInfoModal(false)
        setShowDynamicModal(false)
        setDynamicModalContent({ title: "", body: "", footer: "" })
    }

    const getRoleText = (role: string) => {
        const roleMap = {
            LEADER: "리더",
            SUB_LEADER: "부리더",
            MEMBER: "멤버",
        }
        return roleMap[role as keyof typeof roleMap] || "멤버"
    }

    const formatJoinDate = (joinedAt: string) => {
        if (!joinedAt) return "가입일 정보 없음"
        const date = new Date(joinedAt)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, "0")
        const day = String(date.getDate()).padStart(2, "0")
        return `${year}년 ${month}월 ${day}일 가입`
    }


    const openGroupInfoModal = () => {
        if (!currentGroupData) return
        setGroupName(currentGroupData.name || "")
        setCoverPreviewUrl(currentGroupData.coverImageUrl || "/placeholder.svg?height=200&width=400")
        setCoverImageFile(null)
        setShowGroupInfoModal(true)
    }

    const handleCoverImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            setCoverImageFile(file)
            const reader = new FileReader()
            reader.onload = (e) => {
                setCoverPreviewUrl(e.target?.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const removeCoverImage = () => {
        setCoverPreviewUrl("/placeholder.svg?height=200&width=400")
        setCoverImageFile(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const updateGroupInfo = async () => {
        try {
            setIsLoading(true)
            if (!groupName.trim()) {
                showToast("벗터 이름을 입력해주세요.", "error")
                return
            }
            const formData = new FormData()
            const requestData: any = {
                name: groupName,
                description: currentGroupData?.description,
                access: currentGroupData!.access,
                type: currentGroupData!.type,
                interest: currentGroupData!.interest,
                coverAttachmentId: currentGroupData?.coverAttachmentId ?? null,
            }

            if (coverImageFile) {
                formData.append("coverImage", coverImageFile)
                requestData.coverAttachmentId = null
            } else {
                const isDefaultImage = coverPreviewUrl.includes("placeholder.svg") || coverPreviewUrl.includes("#")
                if (isDefaultImage) {
                    requestData.coverAttachmentId = null
                } else {
                    requestData.coverAttachmentId = currentGroupData?.coverAttachmentId ?? null
                }
            }

            formData.append("request", new Blob([JSON.stringify(requestData)], { type: "application/json" }))
            const response = await api.put(`/groups/${groupId}`, formData)
            if (response.status === 200 && response.data.result) {
                setCurrentGroupData(response.data.result)
                setShowGroupInfoModal(false)
                showToast("벗터 정보가 성공적으로 업데이트되었습니다.")
            } else {
                throw new Error(response.data.message || "업데이트 실패")
            }
        } catch (error: any) {
            console.error("모임 정보 업데이트 실패:", error)
            showToast(error.message || "모임 정보 업데이트 중 오류가 발생했습니다.", "error")
        } finally {
            setIsLoading(false)
        }
    }

    const openDescriptionModal = () => {
        setDynamicModalContent({ title: "벗터 소개", body: "description", footer: "description" })
        setShowDynamicModal(true)
    }

    const updateDescription = async () => {
        setIsLoading(true)
        try {
            const textarea = document.getElementById("group-description") as HTMLTextAreaElement
            const description = textarea?.value.trim() || ""
            const requestData = {
                name: currentGroupData?.name,
                description,
                access: currentGroupData?.access,
                type: currentGroupData?.type,
                interest: currentGroupData?.interest,
            }
            const formData = new FormData()
            formData.append("request", new Blob([JSON.stringify(requestData)], { type: "application/json" }))
            const res = await api.put(`/groups/${groupId}`, formData)
            setCurrentGroupData(res.data.result)
            closeModal()
            showToast("벗터 소개가 성공적으로 업데이트되었습니다.")
        } catch (err: any) {
            console.error("소개 업데이트 실패:", err)
            const msg = err.response?.data?.message || "소개 업데이트 중 오류가 발생했습니다."
            showToast(msg, "error")
        } finally {
            setIsLoading(false)
        }
    }

    const openAccessModal = () => {
        setDynamicModalContent({ title: "벗터 공개 타입", body: "access", footer: "access" })
        setShowDynamicModal(true)
    }

    const updateAccess = async () => {
        setIsLoading(true)
        try {
            const selectedAccess = (document.querySelector('input[name="access"]:checked') as HTMLInputElement)?.value
            if (!selectedAccess) {
                showToast("공개 설정을 선택해주세요.", "error")
                return
            }
            const requestData = {
                name: currentGroupData?.name,
                description: currentGroupData?.description,
                access: selectedAccess,
                type: currentGroupData?.type,
                interest: currentGroupData?.interest,
            }
            const formData = new FormData()
            formData.append("request", new Blob([JSON.stringify(requestData)], { type: "application/json" }))
            const res = await api.put(`/groups/${groupId}`, formData)
            setCurrentGroupData(res.data.result)
            closeModal()
            showToast("공개 설정이 성공적으로 업데이트되었습니다.")
        } catch (err: any) {
            console.error("공개 설정 업데이트 실패:", err)
            const msg = err.response?.data?.message || "공개 설정 업데이트 중 오류가 발생했습니다."
            showToast(msg, "error")
        } finally {
            setIsLoading(false)
        }
    }

    const openTypeModal = () => {
        setDynamicModalContent({ title: "벗터 유형", body: "type", footer: "type" })
        setShowDynamicModal(true)
    }

    const updateType = async () => {
        setIsLoading(true)
        try {
            const selectedType = (document.querySelector('input[name="type"]:checked') as HTMLInputElement)?.value
            if (!selectedType) {
                showToast("모임 유형을 선택해주세요.", "error")
                return
            }
            const requestData = {
                name: currentGroupData?.name,
                description: currentGroupData?.description,
                access: currentGroupData?.access,
                type: selectedType,
                interest: currentGroupData?.interest,
            }
            const formData = new FormData()
            formData.append("request", new Blob([JSON.stringify(requestData)], { type: "application/json" }))
            const res = await api.put(`/groups/${groupId}`, formData)
            setCurrentGroupData(res.data.result)
            closeModal()
            showToast("모임 유형이 성공적으로 업데이트되었습니다.")
        } catch (err: any) {
            console.error("모임 유형 업데이트 실패:", err)
            const msg = err.response?.data?.message || "모임 유형 업데이트 중 오류가 발생했습니다."
            showToast(msg, "error")
        } finally {
            setIsLoading(false)
        }
    }

    const openInterestModal = () => {
        setDynamicModalContent({ title: "벗터 관심사", body: "interest", footer: "interest" })
        setShowDynamicModal(true)
    }

    const updateInterest = async () => {
        setIsLoading(true)
        try {
            const selectedInterest = (document.querySelector('input[name="interest"]:checked') as HTMLInputElement)?.value
            if (!selectedInterest) {
                showToast("관심사를 선택해주세요.", "error")
                return
            }
            const requestData = {
                name: currentGroupData?.name,
                description: currentGroupData?.description,
                access: currentGroupData?.access,
                type: currentGroupData?.type,
                interest: selectedInterest,
            }
            const formData = new FormData()
            formData.append("request", new Blob([JSON.stringify(requestData)], { type: "application/json" }))
            const res = await api.put(`/groups/${groupId}`, formData)
            setCurrentGroupData(res.data.result)
            closeModal()
            showToast("관심사가 성공적으로 업데이트되었습니다.")
        } catch (err: any) {
            console.error("관심사 업데이트 실패:", err)
            const msg = err.response?.data?.message || "관심사 업데이트 중 오류가 발생했습니다."
            showToast(msg, "error")
        } finally {
            setIsLoading(false)
        }
    }


    const handleNeighborhoodAuthToggle = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        if (isProcessing) return;

        const { checked } = event.target;
        setIsProcessing(true);

        try {
            const res = await api.patch(
                `/groups/${groupId}/neighborhood-auth-required`,
                JSON.stringify(checked)
            );

            setCurrentGroupData(res.data.result);
            showToast(
                `동네 인증 설정이 ${checked ? "활성화" : "비활성화"}되었습니다.`
            );
        } catch (err: any) {
            console.error("동네 인증 설정 변경 실패:", err);
            const msg =
                err.response?.data?.message ||
                "동네 인증 설정 변경 중 오류가 발생했습니다.";
            showToast(msg, "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const openInviteLinkModal = async () => {
        if (!hasPermission("CREATE_INVITE_LINK")) {
            showToast("초대 링크를 생성할 권한이 없습니다.", "error")
            return
        }
        try {
            setIsLoading(true)
            const response = await api.post(`/groups/${groupId}/invites`)
            if (response.status === 200 && response.data.result) {
                const inviteCode = response.data.result.code
                const inviteLink = `${window.location.origin}/invite?code=${inviteCode}`
                navigator.clipboard.writeText(inviteLink)
                showToast("초대 링크가 클립보드에 복사되었습니다!", "success")
            } else {
                throw new Error(response.data.message || "초대 링크 생성 실패")
            }
        } catch (error: any) {
            console.error("초대 링크 생성 실패:", error)
            showToast(error.message || "초대 링크 생성 중 오류가 발생했습니다.", "error")
        } finally {
            setIsLoading(false)
        }
    }

    const updateGroupAddress = async () => {
        if (!confirm("내 위치 정보를 기반으로 벗터의 동네를 업데이트하시겠습니까?")) {
            return;
        }
        setIsLoading(true);

        try {
            const res = await api.patch(`/groups/${groupId}/address`);
            setCurrentGroupData(res.data.result);
            showToast("벗터 동네가 성공적으로 업데이트되었습니다.");
        } catch (err: any) {
            console.error("동네 업데이트 실패:", err);
            const msg =
                err.response?.data?.message ||
                "동네 업데이트 중 오류가 발생했습니다.";
            showToast(msg, "error");
        } finally {
            setIsLoading(false);
        }
    };



    // 권한 관리 함수들
    const openMemberRoleModal = async () => {
        try {
            setIsLoading(true)
            const response = await api.get(`/groups/${groupId}/members`)
            if (response.status === 200 && response.data.result) {
                setCurrentMembers(response.data.result.members || [])
                setDynamicModalContent({ title: "멤버 권한 설정", body: "memberRole", footer: "memberRole" })
                setShowDynamicModal(true)
            } else {
                throw new Error(response.data.message || "멤버 목록 조회 실패")
            }
        } catch (error: any) {
            console.error("멤버 권한 설정 모달 열기 실패:", error)
            showToast(error.message || "멤버 목록을 불러오는데 실패했습니다.", "error")
        } finally {
            setIsLoading(false)
        }
    }

    const changeMemberRole = async (memberId: number, newRole: string) => {
        try {
            setIsLoading(true)

            const response = await api.patch(`/groups/${groupId}/members/${memberId}/role`, {
                role: newRole,
            })

            if (response.status === 200 && response.data.result) {
                showToast("멤버 권한이 성공적으로 변경되었습니다.")
                closeModal()
                setTimeout(() => openMemberRoleModal(), 500)
            } else {
                throw new Error(response.data.message || "권한 변경 실패")
            }
        } catch (error: any) {
            console.error("멤버 권한 변경 실패:", error)
            showToast(error.message || "멤버 권한 변경 중 오류가 발생했습니다.", "error")
        } finally {
            setIsLoading(false)
        }
    }


    const openPermissionModal = async () => {
        try {
            setIsLoading(true)
            const response = await api.get(`/groups/${groupId}/permissions`)
            if (response.status === 200 && response.data.result) {
                setCurrentPermissions(response.data.result.permissions || [])
                setDynamicModalContent({ title: "기능별 권한 설정", body: "permission", footer: "permission" })
                setShowDynamicModal(true)
            } else {
                throw new Error(response.data.message || "권한 정보 조회 실패")
            }
        } catch (error: any) {
            console.error("권한 설정 모달 열기 실패:", error)
            showToast(error.message || "권한 정보를 불러오는데 실패했습니다.", "error")
        } finally {
            setIsLoading(false)
        }
    }

    const updatePermissions = async () => {
        try {
            setIsLoading(true)
            const selects = document.querySelectorAll(".settings-permission-select") as NodeListOf<HTMLSelectElement>
            const permissions = Array.from(selects).map((select) => ({
                type: select.dataset.permission,
                role: select.value,
            }))
            const response = await api.post(`/groups/${groupId}/permissions`, permissions)
            if (response.status === 200 && response.data.result) {
                setCurrentPermissions(response.data.result.permissions || [])
                closeModal()
                showToast("권한 설정이 성공적으로 업데이트되었습니다.")
            } else {
                throw new Error(response.data.message || "권한 업데이트 실패")
            }
        } catch (error: any) {
            console.error("권한 업데이트 실패:", error)
            showToast(error.message || "권한 업데이트 중 오류가 발생했습니다.", "error")
        } finally {
            setIsLoading(false)
        }
    }

    // 멤버 관리 함수들
    const openJoinRequestModal = async () => {
        try {
            setIsLoading(true)
            const response = await api.get(`/groups/${groupId}/members/requested`)
            if (response.status === 200 && response.data.result) {
                setCurrentMembers(response.data.result.members || [])
                setDynamicModalContent({ title: "가입 요청 중인 회원 관리", body: "joinRequest", footer: "joinRequest" })
                setShowDynamicModal(true)
            } else {
                throw new Error(response.data.message || "가입 요청 목록 조회 실패")
            }
        } catch (error: any) {
            console.error("가입 요청 관리 모달 열기 실패:", error)
            showToast(error.message || "가입 요청 목록을 불러오는데 실패했습니다.", "error")
        } finally {
            setIsLoading(false)
        }
    }

    const approveMember = async (memberId: number) => {
        try {
            setIsLoading(true);
            // 가입 승인
            await api.patch(`/groups/${groupId}/members/${memberId}/approve`);

            // 2️채팅방 목록 조회 (경로를 singular 'group' 으로!)
            const roomsRes = await api.get(`/group/${groupId}/chat/rooms/my`);
            const rooms = roomsRes.data.result ?? roomsRes.data.data;
            if (!Array.isArray(rooms) || rooms.length === 0) {
                throw new Error("초대할 채팅방을 찾을 수 없습니다.");
            }
            const chatRoomId = rooms[0].roomId;

            // 3️해당 방에 사용자 초대
            await api.post(
                `/group/${groupId}/chat/rooms/${chatRoomId}/participants`,
                { userId: memberId }
            );

            showToast("가입 요청이 승인되고, 채팅방에 초대되었습니다.");
            closeModal();
            setTimeout(() => openJoinRequestModal(), 500);
        } catch (error: any) {
            console.error("가입 승인 또는 채팅방 초대 실패:", error);
            showToast(
                error.response?.data?.message || "가입 승인 중 오류가 발생했습니다.",
                "error"
            );
        } finally {
            setIsLoading(false);
        }
    };


    const rejectMember = async (memberId: number) => {
        if (!confirm("이 가입 요청을 거절하시겠습니까?")) return
        try {
            setIsLoading(true)
            const response = await api.delete(`/groups/${groupId}/members/${memberId}/reject`)
            if (response.status === 200) {
                showToast("가입 요청이 거절되었습니다.")
                closeModal()
                setTimeout(() => openJoinRequestModal(), 500)
            } else {
                const data = response.data
                throw new Error(data.message || "가입 거절 실패")
            }
        } catch (error: any) {
            console.error("가입 거절 실패:", error)
            showToast(error.message || "가입 거절 중 오류가 발생했습니다.", "error")
        } finally {
            setIsLoading(false)
        }
    }

    const openExpelMemberModal = async () => {
        try {
            setIsLoading(true)
            const response = await api.get(`/groups/${groupId}/members`)
            if (response.status === 200 && response.data.result) {
                const members = response.data.result.members || []
                const expellableMembers = members.filter((member: Member) => member.role !== "LEADER")
                setCurrentMembers(expellableMembers)
                setDynamicModalContent({ title: "멤버 강제 탈퇴", body: "expelMember", footer: "expelMember" })
                setShowDynamicModal(true)
            } else {
                throw new Error(response.data.message || "멤버 목록 조회 실패")
            }
        } catch (error: any) {
            console.error("멤버 강제 탈퇴 모달 열기 실패:", error)
            showToast(error.message || "멤버 목록을 불러오는데 실패했습니다.", "error")
        } finally {
            setIsLoading(false)
        }
    }

    const expelMember = async (memberId: number, memberName: string) => {
        if (
            !confirm(
                `${memberName}님을 벗터에서 강제 탈퇴시키시겠습니까?\n\n강제 탈퇴된 멤버는 다시 가입 요청할 수 있습니다.`,
            )
        ) {
            return
        }
        try {
            setIsLoading(true)
            const response = await api.delete(`/groups/${groupId}/members/${memberId}/expel`)
            if (response.status === 200) {
                // 채팅방에서도 강퇴 처리
                const rooms = await fetchChatRooms()
                const chatRoomId = findGroupRoomId(rooms)
                if (chatRoomId) await removeChatParticipant(chatRoomId, memberId)

                showToast(`${memberName}님이 강제 탈퇴되었습니다.`)
                closeModal()
                setTimeout(() => openExpelMemberModal(), 500)
            } else {
                const data = response.data
                throw new Error(data.message || "강제 탈퇴 실패")
            }
        } catch (error: any) {
            console.error("멤버 강제 탈퇴 실패:", error)
            showToast(error.message || "멤버 강제 탈퇴 중 오류가 발생했습니다.", "error")
        } finally {
            setIsLoading(false)
        }
    }

    const openBlockMemberModal = async () => {
        try {
            setIsLoading(true)
            const [membersResponse, blockedResponse] = await Promise.all([
                api.get(`/groups/${groupId}/members`),
                api.get(`/groups/${groupId}/members/blocked`),
            ])

            if (membersResponse.status === 200 && blockedResponse.status === 200) {
                const members = membersResponse.data.result.members || []
                const blockedMembers = blockedResponse.data.result.members || []
                const blockableMembers = members.filter((member: Member) => member.role !== "LEADER")

                setCurrentMembers([...blockableMembers, ...blockedMembers.map((m: Member) => ({ ...m, isBlocked: true }))])
                setDynamicModalContent({ title: "멤버 차단 및 차단 해제", body: "blockMember", footer: "blockMember" })
                setShowDynamicModal(true)
            } else {
                throw new Error("멤버 목록 조회 실패")
            }
        } catch (error: any) {
            console.error("멤버 차단 관리 모달 열기 실패:", error)
            showToast(error.message || "멤버 목록을 불러오는데 실패했습니다.", "error")
        } finally {
            setIsLoading(false)
        }
    }

    const blockMember = async (memberId: number, memberName: string) => {
        if (!confirm(`${memberName}님을 차단하시겠습니까?\n\n차단된 멤버는 벗터에서 탈퇴되며, 다시 가입할 수 없습니다.`)) {
            return
        }
        try {
            setIsLoading(true)
            const response = await api.patch(`/groups/${groupId}/members/${memberId}/block`)
            if (response.status === 200 && response.data.result) {
                // 채팅방에서도 강퇴 처리
                const rooms = await fetchChatRooms()
                const chatRoomId = findGroupRoomId(rooms)
                if (chatRoomId) await removeChatParticipant(chatRoomId, memberId)

                showToast(`${memberName}님이 차단되었습니다.`)
                closeModal()
                setTimeout(() => openBlockMemberModal(), 500)
            } else {
                throw new Error(response.data.message || "멤버 차단 실패")
            }
        } catch (error: any) {
            console.error("멤버 차단 실패:", error)
            showToast(error.message || "멤버 차단 중 오류가 발생했습니다.", "error")
        } finally {
            setIsLoading(false)
        }
    }

    const unblockMember = async (memberId: number, memberName: string) => {
        if (!confirm(`${memberName}님의 차단을 해제하시겠습니까?`)) return
        try {
            setIsLoading(true)
            const response = await api.delete(`/groups/${groupId}/members/${memberId}/unblock`)
            if (response.status === 200) {
                showToast(`${memberName}님의 차단이 해제되었습니다.`)
                closeModal()
                setTimeout(() => openBlockMemberModal(), 500)
            } else {
                const data = response.data
                throw new Error(data.message || "차단 해제 실패")
            }
        } catch (error: any) {
            console.error("멤버 차단 해제 실패:", error)
            showToast(error.message || "멤버 차단 해제 중 오류가 발생했습니다.", "error")
        } finally {
            setIsLoading(false)
        }
    }

    const openDelegateLeaderModal = async () => {
        try {
            setIsLoading(true)
            const response = await api.get(`/groups/${groupId}/members`)
            if (response.status === 200 && response.data.result) {
                const members = response.data.result.members || []
                const delegatableMembers = members.filter((member: Member) => member.role !== "LEADER")
                setCurrentMembers(delegatableMembers)
                setDynamicModalContent({ title: "리더 위임하기", body: "delegateLeader", footer: "delegateLeader" })
                setShowDynamicModal(true)
            } else {
                throw new Error(response.data.message || "멤버 목록 조회 실패")
            }
        } catch (error: any) {
            console.error("리더 위임 모달 열기 실패:", error)
            showToast(error.message || "멤버 목록을 불러오는데 실패했습니다.", "error")
        } finally {
            setIsLoading(false)
        }
    }

    const delegateLeader = async (memberId: number, memberName: string) => {
        if (
            !confirm(
                `${memberName}님에게 리더를 위임하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없으며, 본인은 일반 멤버가 됩니다.`,
            )
        ) {
            return
        }
        if (!confirm("정말로 리더를 위임하시겠습니까? 다시 한 번 확인해주세요.")) {
            return
        }
        try {
            setIsLoading(true)
            const response = await api.patch(`/groups/${groupId}/members/${memberId}/delegate`)
            if (response.status === 200 && response.data.result) {
                showToast(`${memberName}님에게 리더가 위임되었습니다.`)
                closeModal()
                setTimeout(() => {
                    window.location.reload()
                }, 1000)
            } else {
                throw new Error(response.data.message || "리더 위임 실패")
            }
        } catch (error: any) {
            console.error("리더 위임 실패:", error)
            showToast(error.message || "리더 위임 중 오류가 발생했습니다.", "error")
        } finally {
            setIsLoading(false)
        }
    }

    const deleteGroup = async () => {
        if (!confirm("정말로 이 벗터를 삭제하시겠습니까?\n\n⚠️ 삭제된 벗터의 모든 데이터는 복구할 수 없습니다.")) {
            return
        }
        if (
            !confirm(
                "마지막 확인입니다. 벗터를 삭제하면 모든 게시글, 댓글, 일정, 미션 등이 영구적으로 삭제됩니다.\n\n정말로 삭제하시겠습니까?",
            )
        ) {
            return
        }
        setIsLoading(true)
        try {
            // 채팅방 나가기 처리
            const rooms = await fetchChatRooms()
            const chatRoomId = findGroupRoomId(rooms)
            if (chatRoomId) await leaveChatRoom(chatRoomId)

            await api.delete(`/groups/${groupId}`)
            showToast("벗터가 성공적으로 삭제되었습니다.")
            setTimeout(() => {
                router.push("/")
            }, 1000)
        } catch (err: any) {
            console.error("벗터 삭제 실패:", err)
            const msg = err.response?.data?.message || "벗터 삭제 중 오류가 발생했습니다."
            showToast(msg, "error")
        } finally {
            setIsLoading(false)
        }
    }

    const renderDynamicModalContent = () => {
        switch (dynamicModalContent.body) {
            case "description":
                return (
                    <div className={styles.settingsFormGroup}>
                        <label htmlFor="group-description">벗터 소개</label>
                        <textarea
                            id="group-description"
                            maxLength={200}
                            placeholder="벗터를 소개해주세요"
                            defaultValue={currentGroupData?.description || ""}
                            onChange={(e) => {
                                const count = e.target.value.length
                                const counter = e.target.parentElement?.querySelector(".settings-char-count")
                                if (counter) {
                                    counter.textContent = `${count}/200`
                                }
                            }}
                        />
                        <small className={styles.settingsCharCount}>0/200</small>
                    </div>
                )

            case "access":
                return (
                    <div className={styles.settingsFormGroup}>
                        <div className={styles.settingsSectionHeader}>
                            <p>모임의 공개 범위를 선택해주세요</p>
                        </div>
                        <div className={styles.settingsRadioGroup}>
                            <label className={styles.settingsRadioCard} htmlFor="access-public">
                                <input
                                    type="radio"
                                    id="access-public"
                                    name="access"
                                    value="PUBLIC"
                                    defaultChecked={currentGroupData?.access === "PUBLIC"}
                                />
                                <div className={styles.settingsRadioContent}>
                                    <div className={styles.settingsRadioIcon}>🌍</div>
                                    <div className={styles.settingsRadioInfo}>
                                        <div className={styles.settingsRadioTitle}>공개</div>
                                        <div className={styles.settingsRadioDesc}>누구나 벗터를 찾고 가입 요청할 수 있습니다</div>
                                    </div>
                                </div>
                            </label>
                            <label className={styles.settingsRadioCard} htmlFor="access-private">
                                <input
                                    type="radio"
                                    id="access-private"
                                    name="access"
                                    value="PRIVATE"
                                    defaultChecked={currentGroupData?.access === "PRIVATE"}
                                />
                                <div className={styles.settingsRadioContent}>
                                    <div className={styles.settingsRadioIcon}>🔒</div>
                                    <div className={styles.settingsRadioInfo}>
                                        <div className={styles.settingsRadioTitle}>비공개</div>
                                        <div className={styles.settingsRadioDesc}>초대를 통해서만 가입할 수 있습니다</div>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>
                )

            case "type":
                return (
                    <div className={styles.settingsFormGroup}>
                        <div className={styles.settingsSectionHeader}>
                            <p>어떤 방식으로 모임을 진행하시나요?</p>
                        </div>
                        <div className={styles.settingsRadioGroup}>
                            <label className={styles.settingsRadioCard} htmlFor="type-online">
                                <input
                                    type="radio"
                                    id="type-online"
                                    name="type"
                                    value="ONLINE"
                                    defaultChecked={currentGroupData?.type === "ONLINE"}
                                />
                                <div className={styles.settingsRadioContent}>
                                    <div className={styles.settingsRadioIcon}>💻</div>
                                    <div className={styles.settingsRadioInfo}>
                                        <div className={styles.settingsRadioTitle}>온라인</div>
                                        <div className={styles.settingsRadioDesc}>채팅으로 만나요</div>
                                    </div>
                                </div>
                            </label>
                            <label className={styles.settingsRadioCard} htmlFor="type-offline">
                                <input
                                    type="radio"
                                    id="type-offline"
                                    name="type"
                                    value="OFFLINE"
                                    defaultChecked={currentGroupData?.type === "OFFLINE"}
                                />
                                <div className={styles.settingsRadioContent}>
                                    <div className={styles.settingsRadioIcon}>🏢</div>
                                    <div className={styles.settingsRadioInfo}>
                                        <div className={styles.settingsRadioTitle}>오프라인</div>
                                        <div className={styles.settingsRadioDesc}>동네에서 만나요</div>
                                    </div>
                                </div>
                            </label>
                            <label className={styles.settingsRadioCard} htmlFor="type-hybrid">
                                <input
                                    type="radio"
                                    id="type-hybrid"
                                    name="type"
                                    value="HYBRID"
                                    defaultChecked={currentGroupData?.type === "HYBRID"}
                                />
                                <div className={styles.settingsRadioContent}>
                                    <div className={styles.settingsRadioIcon}>🔄</div>
                                    <div className={styles.settingsRadioInfo}>
                                        <div className={styles.settingsRadioTitle}>온·오프라인</div>
                                        <div className={styles.settingsRadioDesc}>상황에 따라 유연하게 진행해요</div>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>
                )

            case "interest":
                const interests = [
                    { value: "HOBBY", label: "취미", icon: "🎨" },
                    { value: "FAMILY", label: "가족", icon: "👨‍👩‍👧‍👦" },
                    { value: "SCHOOL", label: "학교", icon: "🎓" },
                    { value: "BUSINESS", label: "업무", icon: "💼" },
                    { value: "EXERCISE", label: "운동", icon: "💪" },
                    { value: "GAME", label: "게임", icon: "🎮" },
                    { value: "STUDY", label: "스터디", icon: "📚" },
                    { value: "FAN", label: "팬", icon: "⭐" },
                    { value: "OTHER", label: "기타", icon: "🌟" },
                ]

                return (
                    <div className={styles.settingsFormGroup}>
                        <div className={styles.settingsSectionHeader}>
                            <p>모임의 주요 관심사를 선택해주세요</p>
                        </div>
                        <div className={styles.settingsInterestGrid}>
                            {interests.map((interest) => (
                                <label
                                    key={interest.value}
                                    className={styles.settingsInterestCard}
                                    htmlFor={`interest-${interest.value.toLowerCase()}`}
                                >
                                    <input
                                        type="radio"
                                        id={`interest-${interest.value.toLowerCase()}`}
                                        name="interest"
                                        value={interest.value}
                                        defaultChecked={currentGroupData?.interest === interest.value}
                                    />
                                    <div className={styles.settingsInterestContent}>
                                        <div className={styles.settingsInterestIcon}>{interest.icon}</div>
                                        <div className={styles.settingsInterestTitle}>{interest.label}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                )

            case "memberRole":
                return (
                    <div className={styles.settingsMemberList}>
                        {currentMembers.map((member) => {
                            const canChangeRole = member.role !== "LEADER"
                            return (
                                <div key={member.id} className={styles.settingsMemberItem}>
                                    <div className={styles.settingsMemberInfo}>
                                        <img
                                            src={member.profileImageUrl || "/placeholder.svg?height=40&width=40"}
                                            alt={member.name}
                                            className={styles.settingsMemberAvatar}
                                        />
                                        <div className={styles.settingsMemberDetails}>
                                            <h5>{member.name}</h5>
                                            <p>{formatJoinDate(member.joinedAt)}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <span className={`${styles.settingsMemberRole} ${styles[member.role.toLowerCase()]}`}>
                                            {getRoleText(member.role)}
                                        </span>
                                        {canChangeRole && (
                                            <button
                                                className={`${styles.settingsBtn} ${styles.settingsBtnSecondary}`}
                                                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                                                onClick={() =>
                                                    changeMemberRole(member.id, member.role === "SUB_LEADER" ? "MEMBER" : "SUB_LEADER")
                                                }
                                            >
                                                {member.role === "SUB_LEADER" ? "멤버로 변경" : "부리더로 변경"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )

            case "permission":
                const allPermissionTypes: PermissionType[] = [
                    "CREATE_POST",
                    "DELETE_POST",
                    "CREATE_SCHEDULE",
                    "DELETE_SCHEDULE",
                    "CREATE_MISSION",
                    "DELETE_MISSION",
                    "CREATE_VOTE",
                    "DELETE_VOTE",
                    "CREATE_DIRECT_CHAT_ROOM",
                    "CREATE_INVITE_LINK",
                    "INVITE_CHAT_PARTICIPANT",
                    "KICK_CHAT_PARTICIPANT",
                ]

                const permissionMap: Record<PermissionType, string> = {} as Record<PermissionType, string>
                currentPermissions.forEach((p) => {
                    permissionMap[p.type as PermissionType] = p.role
                })

                allPermissionTypes.forEach((type) => {
                    if (!permissionMap[type]) {
                        permissionMap[type] = "MEMBER"
                    }
                })

                const createPermissions = allPermissionTypes.filter(
                    (type) => type.startsWith("CREATE_") || type.includes("INVITE_"),
                )
                const deletePermissions = allPermissionTypes.filter(
                    (type) => type.startsWith("DELETE_") || type.includes("KICK_"),
                )

                const permissionGroups = [
                    {
                        title: "콘텐츠 생성 권한",
                        permissions: createPermissions,
                        descriptions: {
                            CREATE_POST: "게시글 작성",
                            CREATE_SCHEDULE: "일정 등록",
                            CREATE_MISSION: "미션 등록",
                            CREATE_VOTE: "투표 생성",
                            CREATE_DIRECT_CHAT_ROOM: "일대일 채팅방 생성",
                            CREATE_INVITE_LINK: "초대 링크 생성",
                            INVITE_CHAT_PARTICIPANT: "채팅방 초대",
                        } as Record<PermissionType, string>,
                    },
                    {
                        title: "다른 멤버의 콘텐츠 삭제 권한",
                        permissions: deletePermissions,
                        descriptions: {
                            DELETE_POST: "다른 멤버의 게시글 삭제",
                            DELETE_SCHEDULE: "다른 멤버의 일정 삭제",
                            DELETE_MISSION: "다른 멤버의 미션 삭제",
                            DELETE_VOTE: "다른 멤버의 투표 삭제",
                            KICK_CHAT_PARTICIPANT: "채팅방 강퇴",
                        } as Record<PermissionType, string>,
                    },
                ]

                return (
                    <div>
                        {permissionGroups.map((group) => (
                            <div key={group.title} className={styles.settingsPermissionGroup}>
                                <h4>{group.title}</h4>
                                {group.permissions.map((permissionType) => {
                                    const isDeletePermission = permissionType.startsWith("DELETE_") || permissionType.includes("KICK_")
                                    return (
                                        <div key={permissionType} className={styles.settingsPermissionItem}>
                                            <div className={styles.settingsPermissionInfo}>
                                                <h5>{group.descriptions[permissionType] || permissionType}</h5>
                                                <p>이 기능을 사용할 수 있는 최소 권한을 설정합니다</p>
                                            </div>
                                            <select
                                                className={`${styles.settingsPermissionSelect} settings-permission-select`}
                                                data-permission={permissionType}
                                                defaultValue={permissionMap[permissionType]}
                                            >
                                                {!isDeletePermission && <option value="MEMBER">멤버</option>}
                                                <option value="SUB_LEADER">부리더</option>
                                                <option value="LEADER">리더</option>
                                            </select>
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                )

            case "joinRequest":
                return (
                    <div>
                        {currentMembers.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "40px", color: "#718096" }}>
                                <p>가입 요청 중인 회원이 없습니다.</p>
                            </div>
                        ) : (
                            <div className={styles.settingsMemberList}>
                                {currentMembers.map((member) => (
                                    <div key={member.id} className={styles.settingsMemberItem}>
                                        <div className={styles.settingsMemberInfo}>
                                            <img
                                                src={member.profileImageUrl || "/placeholder.svg?height=40&width=40"}
                                                alt={member.name}
                                                className={styles.settingsMemberAvatar}
                                            />
                                            <div className={styles.settingsMemberDetails}>
                                                <h5>{member.name}</h5>
                                                <p>가입 요청일: {formatJoinDate(member.joinedAt)}</p>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <button
                                                className={`${styles.settingsBtn} ${styles.settingsBtnPrimary}`}
                                                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                                                onClick={() => approveMember(member.id)}
                                            >
                                                승인
                                            </button>
                                            <button
                                                className={`${styles.settingsBtn} ${styles.settingsBtnDanger}`}
                                                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                                                onClick={() => rejectMember(member.id)}
                                            >
                                                거절
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )

            case "expelMember":
                return (
                    <div>
                        {currentMembers.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "40px", color: "#718096" }}>
                                <p>강제 탈퇴시킬 수 있는 멤버가 없습니다.</p>
                            </div>
                        ) : (
                            <div>
                                <div
                                    style={{
                                        marginBottom: "16px",
                                        padding: "12px",
                                        background: "rgba(229, 62, 62, 0.1)",
                                        borderRadius: "8px",
                                        color: "#e53e3e",
                                        fontSize: "0.9rem",
                                    }}
                                >
                                    ⚠️ 강제 탈퇴된 멤버는 다시 가입할 수 있습니다. 완전히 차단하려면 '멤버 차단' 기능을 사용하세요.
                                </div>
                                <div className={styles.settingsMemberList}>
                                    {currentMembers.map((member) => (
                                        <div key={member.id} className={styles.settingsMemberItem}>
                                            <div className={styles.settingsMemberInfo}>
                                                <img
                                                    src={member.profileImageUrl || "/placeholder.svg?height=40&width=40"}
                                                    alt={member.name}
                                                    className={styles.settingsMemberAvatar}
                                                />
                                                <div className={styles.settingsMemberDetails}>
                                                    <h5>{member.name}</h5>
                                                    <p>
                                                        {getRoleText(member.role)} • {formatJoinDate(member.joinedAt)}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                className={`${styles.settingsBtn} ${styles.settingsBtnDanger}`}
                                                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                                                onClick={() => expelMember(member.id, member.name)}
                                            >
                                                강제 탈퇴
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )

            case "blockMember":
                const blockableMembers = currentMembers.filter((m: any) => !m.isBlocked)
                const blockedMembers = currentMembers.filter((m: any) => m.isBlocked)

                return (
                    <div>
                        {blockableMembers.length > 0 && (
                            <div style={{ marginBottom: "24px" }}>
                                <h4 style={{ color: "#4a5568", marginBottom: "12px" }}>멤버 차단</h4>
                                <div
                                    style={{
                                        marginBottom: "12px",
                                        padding: "12px",
                                        background: "rgba(229, 62, 62, 0.1)",
                                        borderRadius: "8px",
                                        color: "#e53e3e",
                                        fontSize: "0.9rem",
                                    }}
                                >
                                    ⚠️ 차단된 멤버는 벗터에서 탈퇴되며, 다시 가입할 수 없습니다.
                                </div>
                                <div className={styles.settingsMemberList} style={{ maxHeight: "200px" }}>
                                    {blockableMembers.map((member) => (
                                        <div key={member.id} className={styles.settingsMemberItem}>
                                            <div className={styles.settingsMemberInfo}>
                                                <img
                                                    src={member.profileImageUrl || "/placeholder.svg?height=40&width=40"}
                                                    alt={member.name}
                                                    className={styles.settingsMemberAvatar}
                                                />
                                                <div className={styles.settingsMemberDetails}>
                                                    <h5>{member.name}</h5>
                                                    <p>
                                                        {getRoleText(member.role)} • {formatJoinDate(member.joinedAt)}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                className={`${styles.settingsBtn} ${styles.settingsBtnDanger}`}
                                                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                                                onClick={() => blockMember(member.id, member.name)}
                                            >
                                                차단
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {blockedMembers.length > 0 && (
                            <div>
                                <h4 style={{ color: "#4a5568", marginBottom: "12px" }}>차단된 멤버</h4>
                                <div className={styles.settingsMemberList} style={{ maxHeight: "200px" }}>
                                    {blockedMembers.map((member) => (
                                        <div key={member.id} className={styles.settingsMemberItem}>
                                            <div className={styles.settingsMemberInfo}>
                                                <img
                                                    src={member.profileImageUrl || "/placeholder.svg?height=40&width=40"}
                                                    alt={member.name}
                                                    className={styles.settingsMemberAvatar}
                                                />
                                                <div className={styles.settingsMemberDetails}>
                                                    <h5>{member.name}</h5>
                                                    <p>차단됨 • {formatJoinDate(member.joinedAt)}</p>
                                                </div>
                                            </div>
                                            <button
                                                className={`${styles.settingsBtn} ${styles.settingsBtnPrimary}`}
                                                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                                                onClick={() => unblockMember(member.id, member.name)}
                                            >
                                                차단 해제
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {blockableMembers.length === 0 && blockedMembers.length === 0 && (
                            <div style={{ textAlign: "center", padding: "40px", color: "#718096" }}>
                                <p>차단할 수 있는 멤버나 차단된 멤버가 없습니다.</p>
                            </div>
                        )}
                    </div>
                )

            case "delegateLeader":
                return (
                    <div>
                        {currentMembers.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "40px", color: "#718096" }}>
                                <p>리더를 위임할 수 있는 멤버가 없습니다.</p>
                            </div>
                        ) : (
                            <div>
                                <div
                                    style={{
                                        marginBottom: "16px",
                                        padding: "12px",
                                        background: "rgba(229, 62, 62, 0.1)",
                                        borderRadius: "8px",
                                        color: "#e53e3e",
                                        fontSize: "0.9rem",
                                    }}
                                >
                                    ⚠️ 리더를 위임하면 본인은 일반 멤버가 됩니다. 이 작업은 되돌릴 수 없습니다.
                                </div>
                                <div className={styles.settingsMemberList}>
                                    {currentMembers.map((member) => (
                                        <div key={member.id} className={styles.settingsMemberItem}>
                                            <div className={styles.settingsMemberInfo}>
                                                <img
                                                    src={member.profileImageUrl || "/placeholder.svg?height=40&width=40"}
                                                    alt={member.name}
                                                    className={styles.settingsMemberAvatar}
                                                />
                                                <div className={styles.settingsMemberDetails}>
                                                    <h5>{member.name}</h5>
                                                    <p>
                                                        {getRoleText(member.role)} • {formatJoinDate(member.joinedAt)}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                className={`${styles.settingsBtn} ${styles.settingsBtnPrimary}`}
                                                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                                                onClick={() => delegateLeader(member.id, member.name)}
                                            >
                                                리더 위임하기
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )

            default:
                return null
        }
    }

    const renderDynamicModalFooter = () => {
        switch (dynamicModalContent.footer) {
            case "description":
            case "access":
            case "type":
            case "interest":
                const updateFunctions = {
                    description: updateDescription,
                    access: updateAccess,
                    type: updateType,
                    interest: updateInterest,
                }
                return (
                    <>
                        <button
                            type="button"
                            className={`${styles.settingsBtn} ${styles.settingsBtnSecondary}`}
                            onClick={closeModal}
                        >
                            취소
                        </button>
                        <button
                            type="button"
                            className={`${styles.settingsBtn} ${styles.settingsBtnPrimary}`}
                            onClick={updateFunctions[dynamicModalContent.footer as keyof typeof updateFunctions]}
                        >
                            저장
                        </button>
                    </>
                )
            case "permission":
                return (
                    <>
                        <button
                            type="button"
                            className={`${styles.settingsBtn} ${styles.settingsBtnSecondary}`}
                            onClick={closeModal}
                        >
                            취소
                        </button>
                        <button
                            type="button"
                            className={`${styles.settingsBtn} ${styles.settingsBtnPrimary}`}
                            onClick={updatePermissions}
                        >
                            저장
                        </button>
                    </>
                )
            case "memberRole":
            case "joinRequest":
            case "expelMember":
            case "blockMember":
            case "delegateLeader":
                return (
                    <button type="button" className={`${styles.settingsBtn} ${styles.settingsBtnSecondary}`} onClick={closeModal}>
                        닫기
                    </button>
                )
            default:
                return null
        }
    }

    if (permsLoading || isLoading) {
        const message = permsLoading
        ? "권한 정보를 불러오는 중..."
        : "설정 정보를 불러오는 중...";
        return (
            <div>
                <p>{message}</p>
            </div>
        )
    }

    if (!currentGroupData) {
        return (
            <div className={styles.settingsContainer}>
                <div style={{ textAlign: "center", padding: "40px", color: "#e53e3e" }}>
                    🚫 권한이 없습니다. 리더만 설정 페이지에 접근할 수 있습니다.
                </div>
            </div>
        )
    }

    const accessText = currentGroupData.access === "PUBLIC" ? "공개" : "비공개"
    const typeMap = {
        ONLINE: "온라인",
        OFFLINE: "오프라인",
        HYBRID: "온·오프라인",
    }
    const interestMap = {
        HOBBY: "취미",
        FAMILY: "가족",
        SCHOOL: "학교",
        BUSINESS: "업무",
        EXERCISE: "운동",
        GAME: "게임",
        STUDY: "스터디",
        FAN: "팬",
        OTHER: "기타",
    }

    const isOffline = currentGroupData.type === "OFFLINE" || currentGroupData.type === "HYBRID"

    return (
        <div className={styles.settingsContainer}>
            {/* 벗터 기본 정보 관리 */}
            <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>벗터 기본 정보 관리</h3>
                <div className={styles.settingsMenuList}>
                    <div className={styles.settingsMenuItem} onClick={openGroupInfoModal}>
                        <div className={styles.settingsMenuContent}>
                            <span className={styles.settingsMenuIcon}>📝</span>
                            <div className={styles.settingsMenuText}>
                                <h4>벗터 이름 및 커버 설정</h4>
                                <p>벗터 이름과 커버 이미지를 변경할 수 있습니다</p>
                            </div>
                        </div>
                        <span className={styles.settingsMenuArrow}>›</span>
                    </div>

                    <div className={styles.settingsMenuItem} onClick={openDescriptionModal}>
                        <div className={styles.settingsMenuContent}>
                            <span className={styles.settingsMenuIcon}>💬</span>
                            <div className={styles.settingsMenuText}>
                                <h4>벗터 소개</h4>
                                <p>벗터 소개글을 수정할 수 있습니다</p>
                            </div>
                        </div>
                        <span className={styles.settingsMenuArrow}>›</span>
                    </div>

                    <div className={styles.settingsMenuItem} onClick={openAccessModal}>
                        <div className={styles.settingsMenuContent}>
                            <span className={styles.settingsMenuIcon}>🔒</span>
                            <div className={styles.settingsMenuText}>
                                <h4>벗터 공개 타입</h4>
                                <p>현재: {accessText}</p>
                            </div>
                        </div>
                        <span className={styles.settingsMenuArrow}>›</span>
                    </div>

                    <div className={styles.settingsMenuItem} onClick={openTypeModal}>
                        <div className={styles.settingsMenuContent}>
                            <span className={styles.settingsMenuIcon}>🌐</span>
                            <div className={styles.settingsMenuText}>
                                <h4>벗터 유형</h4>
                                <p>현재: {typeMap[currentGroupData.type] || "온라인"}</p>
                            </div>
                        </div>
                        <span className={styles.settingsMenuArrow}>›</span>
                    </div>

                    <div className={styles.settingsMenuItem} onClick={openInterestModal}>
                        <div className={styles.settingsMenuContent}>
                            <span className={styles.settingsMenuIcon}>🎯</span>
                            <div className={styles.settingsMenuText}>
                                <h4>벗터 관심사</h4>
                                <p>현재: {interestMap[currentGroupData.interest] || "취미"}</p>
                            </div>
                        </div>
                        <span className={styles.settingsMenuArrow}>›</span>
                    </div>

                    {/* 오프라인 모임일 때만 표시 */}
                    {isOffline && (
                        <>
                            {/* 동네 인증  */}
                            <div className={styles.settingsMenuItem}>
                                <div className={styles.settingsMenuContent}>
                                    <span className={styles.settingsMenuIcon}>🏠</span>
                                    <div className={styles.settingsMenuText}>
                                        <h4>동네 인증 사용자만 가입 요청 받기</h4>
                                        <p>동네 인증을 완료한 사용자만 이 벗터에 가입 요청할 수 있습니다</p>
                                    </div>
                                </div>
                                <div className={styles.settingsToggle}>
                                    <input
                                        type="checkbox"
                                        id="neighborhood-auth-toggle"
                                        className={styles.settingsToggleInput}
                                        checked={currentGroupData.isNeighborhoodAuthRequired || false}
                                        onChange={handleNeighborhoodAuthToggle}
                                        disabled={isProcessing}
                                    />
                                    <label
                                        htmlFor="neighborhood-auth-toggle"
                                        className={styles.settingsToggleLabel}
                                    ></label>
                                </div>
                            </div>

                            {/* 동네 업데이트 + 현재 주소 표시 */}
                            <div className={styles.settingsMenuItem}>
                                <div className={styles.settingsMenuContent}>
                                    <span className={styles.settingsMenuIcon}>📍</span>
                                    <div className={styles.settingsMenuText}>
                                        <h4>벗터 동네 업데이트하기</h4>
                                        <p>내 위치 정보를 기반으로 벗터 동네를 설정합니다</p>
                                        {/* 주소가 없으면 기본 문구 */}
                                        <p id="current-address">
                                            {currentGroupData.address || "현재 동네 정보 없음"}
                                        </p>
                                    </div>
                                </div>
                                <span
                                    className={styles.settingsMenuArrow}
                                    onClick={updateGroupAddress}
                                >
                                    ›
                                </span>
                            </div>
                        </>
                    )}

                </div>
            </div>

            {/* 벗터 권한 관리 */}
            <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>벗터 권한 관리</h3>
                <div className={styles.settingsMenuList}>
                    <div className={styles.settingsMenuItem} onClick={openMemberRoleModal}>
                        <div className={styles.settingsMenuContent}>
                            <span className={styles.settingsMenuIcon}>👥</span>
                            <div className={styles.settingsMenuText}>
                                <h4>멤버 권한 설정</h4>
                                <p>멤버들의 역할을 관리할 수 있습니다</p>
                            </div>
                        </div>
                        <span className={styles.settingsMenuArrow}>›</span>
                    </div>

                    <div className={styles.settingsMenuItem} onClick={openPermissionModal}>
                        <div className={styles.settingsMenuContent}>
                            <span className={styles.settingsMenuIcon}>⚙️</span>
                            <div className={styles.settingsMenuText}>
                                <h4>기능별 권한 설정</h4>
                                <p>각 기능별로 필요한 권한을 설정할 수 있습니다</p>
                            </div>
                        </div>
                        <span className={styles.settingsMenuArrow}>›</span>
                    </div>

                    <div className={styles.settingsMenuItem} onClick={openInviteLinkModal}>
                        <div className={styles.settingsMenuContent}>
                            <span className={styles.settingsMenuIcon}>🔗</span>
                            <div className={styles.settingsMenuText}>
                                <h4>초대 링크 생성</h4>
                                <p>벗터 가입을 위한 초대 링크를 생성합니다</p>
                            </div>
                        </div>
                        <span className={styles.settingsMenuArrow}>›</span>
                    </div>
                </div>
            </div>

            {/* 벗터 멤버 관리 */}
            <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>벗터 멤버 관리</h3>
                <div className={styles.settingsMenuList}>
                    <div className={styles.settingsMenuItem} onClick={openJoinRequestModal}>
                        <div className={styles.settingsMenuContent}>
                            <span className={styles.settingsMenuIcon}>📋</span>
                            <div className={styles.settingsMenuText}>
                                <h4>가입 요청 중인 회원 관리</h4>
                                <p>가입 요청을 승인하거나 거절할 수 있습니다</p>
                            </div>
                        </div>
                        <span className={styles.settingsMenuArrow}>›</span>
                    </div>

                    <div className={styles.settingsMenuItem} onClick={openExpelMemberModal}>
                        <div className={styles.settingsMenuContent}>
                            <span className={styles.settingsMenuIcon}>🚫</span>
                            <div className={styles.settingsMenuText}>
                                <h4>멤버 강제 탈퇴</h4>
                                <p>문제가 있는 멤버를 강제로 탈퇴시킬 수 있습니다</p>
                            </div>
                        </div>
                        <span className={styles.settingsMenuArrow}>›</span>
                    </div>

                    <div className={styles.settingsMenuItem} onClick={openBlockMemberModal}>
                        <div className={styles.settingsMenuContent}>
                            <span className={styles.settingsMenuIcon}>🔒</span>
                            <div className={styles.settingsMenuText}>
                                <h4>멤버 차단 및 차단 해제</h4>
                                <p>멤버를 차단하거나 차단을 해제할 수 있습니다</p>
                            </div>
                        </div>
                        <span className={styles.settingsMenuArrow}>›</span>
                    </div>

                    <div className={styles.settingsMenuItem} onClick={openDelegateLeaderModal}>
                        <div className={styles.settingsMenuContent}>
                            <span className={styles.settingsMenuIcon}>👑</span>
                            <div className={styles.settingsMenuText}>
                                <h4>리더 위임하기</h4>
                                <p>다른 멤버에게 리더 권한을 위임할 수 있습니다</p>
                            </div>
                        </div>
                        <span className={styles.settingsMenuArrow}>›</span>
                    </div>
                </div>
            </div>

            {/* 위험한 작업 */}
            <div className={`${styles.settingsSection} ${styles.settingsDangerSection}`}>
                <h3 className={styles.settingsSectionTitle}>위험한 작업</h3>
                <div className={styles.settingsMenuList}>
                    <div className={`${styles.settingsMenuItem} ${styles.settingsDangerItem}`} onClick={deleteGroup}>
                        <div className={styles.settingsMenuContent}>
                            <span className={styles.settingsMenuIcon}>🗑️</span>
                            <div className={styles.settingsMenuText}>
                                <h4>이 벗터 삭제하기</h4>
                                <p>벗터를 완전히 삭제합니다. 이 작업은 되돌릴 수 없습니다</p>
                            </div>
                        </div>
                        <span className={styles.settingsMenuArrow}>›</span>
                    </div>
                </div>
            </div>

            {/* 그룹 정보 수정 모달 */}
            <ModalPortal isOpen={showGroupInfoModal}>
                <div className={styles.settingsModal} onClick={(e) => e.target === e.currentTarget && closeModal()}>
                    <div className={styles.settingsModalContent}>
                        <div className={styles.settingsModalHeader}>
                            <h3>벗터 이름 및 커버 설정</h3>
                            <span className={styles.settingsModalClose} onClick={closeModal}>
                                &times;
                            </span>
                        </div>
                        <div className={styles.settingsModalBody}>
                            <div className={styles.settingsFormGroup}>
                                <label htmlFor="group-name">벗터 이름</label>
                                <input
                                    type="text"
                                    id="group-name"
                                    maxLength={20}
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="벗터 이름을 입력하세요"
                                />
                                <small className={styles.settingsCharCount}>{groupName.length}/20</small>
                            </div>
                            <div className={styles.settingsFormGroup}>
                                <label htmlFor="cover-image">커버 이미지</label>
                                <div className={styles.settingsImageUpload}>
                                    <img
                                        id="cover-preview"
                                        src={coverPreviewUrl || "/placeholder.svg?height=200&width=400"}
                                        alt="커버 이미지 미리보기"
                                    />
                                    <input
                                        type="file"
                                        id="cover-image"
                                        accept="image/*"
                                        style={{ display: "none" }}
                                        ref={fileInputRef}
                                        onChange={handleCoverImageChange}
                                    />
                                    <div className={styles.settingsImageActions}>
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className={styles.settingsUploadBtn}
                                        >
                                            이미지 선택
                                        </button>
                                        <button type="button" onClick={removeCoverImage} className={styles.settingsRemoveBtn}>
                                            이미지 제거
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.settingsModalFooter}>
                            <button
                                type="button"
                                className={`${styles.settingsBtn} ${styles.settingsBtnSecondary}`}
                                onClick={closeModal}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                className={`${styles.settingsBtn} ${styles.settingsBtnPrimary}`}
                                onClick={updateGroupInfo}
                            >
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            </ModalPortal>

            {/* 동적 모달 */}
            <ModalPortal isOpen={showDynamicModal}>
                <div className={styles.settingsModal} onClick={(e) => e.target === e.currentTarget && closeModal()}>
                    <div className={styles.settingsModalContent}>
                        <div className={styles.settingsModalHeader}>
                            <h3>{dynamicModalContent.title}</h3>
                            <span className={styles.settingsModalClose} onClick={closeModal}>
                                &times;
                            </span>
                        </div>
                        <div className={styles.settingsModalBody}>{renderDynamicModalContent()}</div>
                        <div className={styles.settingsModalFooter}>{renderDynamicModalFooter()}</div>
                    </div>
                </div>
            </ModalPortal>

            {/* 로딩 오버레이 */}
            {isLoading && !currentGroupData && (
                <div className={styles.settingsLoadingOverlay}>
                    <div className={styles.settingsLoadingSpinner}></div>
                    <p>처리 중...</p>
                </div>
            )}

            {/* 토스트 메시지 */}
            {toast.show && <div className={`${styles.toast} ${styles.show}`}>{toast.message}</div>}
        </div>
    )
}
