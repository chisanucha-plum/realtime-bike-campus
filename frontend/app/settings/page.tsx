"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  AUTH_USER_UPDATED_EVENT,
  getStoredCurrentUser,
  getStoredUserRole,
  type UserRole,
} from "@/stores/auth-store"
import { useLanguage } from "@/hooks/useLanguage"
import { playViolationBeep } from "@/lib/alert-sound"
import {
  HELMET_SETTINGS_UPDATED_EVENT,
  STORAGE_KEY,
} from "@/lib/app-settings"
import {
  BellRing,
  Camera,
  KeyRound,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  UserRound,
  Volume2,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export type AppSettings = {
  fullName: string
  email: string
  timezone: string
  language: string
  notifyInApp: boolean
  notifyEmail: boolean
  notifySound: boolean
  notifyDigest: string
  realtimeRows: string
  refreshInterval: string
  showOnlyViolations: boolean
  cameraSource: string
  detectionThreshold: string
  snapshotEnabled: boolean
  retentionDays: string
}

const DEFAULT_SETTINGS: AppSettings = {
  fullName: "",
  email: "",
  timezone: "Asia/Bangkok",
  language: "th",
  notifyInApp: true,
  notifyEmail: false,
  notifySound: true,
  notifyDigest: "instant",
  realtimeRows: "20",
  refreshInterval: "5",
  showOnlyViolations: false,
  cameraSource: "rtsp://camera-main",
  detectionThreshold: "0.50",
  snapshotEnabled: true,
  retentionDays: "30",
}

const CARD_CLASS =
  "rounded-2xl border-neutral-200/60 dark:border-neutral-800/80 bg-white/90 dark:bg-[#18181A]/90 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
const CARD_HEADER_CLASS = "pb-3 border-b border-neutral-100 dark:border-neutral-800/60"
const CARD_TITLE_CLASS =
  "flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-white"

export default function SettingsPage() {
  const { language: activeLanguage, setLang, t } = useLanguage()
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [currentUser, setCurrentUser] = useState(getStoredCurrentUser)

  // Sync user info from auth store
  useEffect(() => {
    const syncUser = () => {
      setCurrentUser(getStoredCurrentUser())
    }
    syncUser()
    window.addEventListener(AUTH_USER_UPDATED_EVENT, syncUser)
    return () => window.removeEventListener(AUTH_USER_UPDATED_EVENT, syncUser)
  }, [])

  // Load saved preferences from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const user = getStoredCurrentUser()
      if (!raw) {
        setSettings((prev) => ({
          ...prev,
          fullName: user.fullName || user.username || "",
          email: user.email || "",
        }))
        return
      }

      const parsed = JSON.parse(raw) as Partial<AppSettings>
      setSettings({
        ...DEFAULT_SETTINGS,
        ...parsed,
        fullName: parsed.fullName || user.fullName || user.username || "",
        email: user.email || parsed.email || "",
      })
    } catch {
      setSettings(DEFAULT_SETTINGS)
    }
  }, [])

  const role = currentUser.role || "security"
  const roleBadgeVariant = role === "admin" ? "default" : "secondary"
  const roleLabel =
    role === "admin"
      ? t("settings.admin") || "Admin"
      : role === "security"
        ? t("settings.security") || "Security"
        : t("settings.user") || "User"

  const updateSettings = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    window.dispatchEvent(new Event(HELMET_SETTINGS_UPDATED_EVENT))
    toast.success(t("settings.saveMessage") || "บันทึกการตั้งค่าเรียบร้อยแล้ว")
  }

  const resetToDefaults = () => {
    const resetValues: AppSettings = {
      ...DEFAULT_SETTINGS,
      fullName: currentUser.fullName || currentUser.username || "",
      email: currentUser.email || "",
      language: activeLanguage,
    }
    setSettings(resetValues)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resetValues))
    window.dispatchEvent(new Event(HELMET_SETTINGS_UPDATED_EVENT))
    toast.info(t("settings.resetMessage") || "คืนค่าเริ่มต้นเรียบร้อยแล้ว")
  }

  const handleTestSound = () => {
    playViolationBeep()
    toast.info(t("settings.testSound") || "ทดสอบเสียงแจ้งเตือน (Beep)")
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("settings.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Badge
            variant={roleBadgeVariant}
            className="rounded-full px-3 py-1 text-xs font-semibold shadow-xs"
          >
            {t("settings.role")}: {roleLabel}
          </Badge>

          <Button
            type="button"
            variant="outline"
            onClick={resetToDefaults}
            className="gap-2 rounded-xl border-neutral-200/80 dark:border-neutral-800/80 shadow-xs"
          >
            <RotateCcw className="h-4 w-4 text-neutral-500" />
            <span className="hidden sm:inline">{t("settings.resetDefaults")}</span>
          </Button>

          <Button
            type="button"
            onClick={saveSettings}
            className="gap-2 rounded-xl shadow-xs"
          >
            <Save className="h-4 w-4" />
            {t("settings.saveAll")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-2">
        {/* Card 1: User Profile */}
        <Card className={CARD_CLASS}>
          <CardHeader className={CARD_HEADER_CLASS}>
            <div className="flex items-center justify-between">
              <CardTitle className={CARD_TITLE_CLASS}>
                <UserRound className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                {t("settings.userProfile")}
              </CardTitle>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold rounded-full px-2"
              >
                Functional
              </Badge>
            </div>
            <CardDescription className="text-xs">{t("settings.profileDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-xs font-medium">
                {t("settings.displayName")}
              </Label>
              <Input
                id="fullName"
                value={settings.fullName}
                onChange={(event) => updateSettings("fullName", event.target.value)}
                placeholder={currentUser.fullName || currentUser.username || "ผู้ใช้งาน"}
                className="rounded-xl border-neutral-200/80 dark:border-neutral-800/80"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="email" className="text-xs font-medium">
                  {t("settings.email")}
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  (ระบบยืนยันจากบัญชีผู้ใช้)
                </span>
              </div>
              <Input
                id="email"
                value={currentUser.email || settings.email}
                readOnly
                disabled
                placeholder="example@kmutt.ac.th"
                className="rounded-xl border-neutral-200/80 dark:border-neutral-800/80 bg-muted/40 text-muted-foreground"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="timezone" className="text-xs font-medium">
                  {t("settings.timezone")}
                </Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => updateSettings("timezone", value)}
                >
                  <SelectTrigger
                    id="timezone"
                    className="w-full rounded-xl border-neutral-200/80 dark:border-neutral-800/80"
                  >
                    <SelectValue placeholder="เลือก Time Zone" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Asia/Bangkok">Asia/Bangkok (UTC+7)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language" className="text-xs font-medium">
                  {t("settings.language")}
                </Label>
                <Select
                  value={activeLanguage}
                  onValueChange={(value) => {
                    updateSettings("language", value)
                    setLang(value as "th" | "en")
                  }}
                >
                  <SelectTrigger
                    id="language"
                    className="w-full rounded-xl border-neutral-200/80 dark:border-neutral-800/80"
                  >
                    <SelectValue placeholder="เลือกภาษา" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="th">ไทย (TH)</SelectItem>
                    <SelectItem value="en">English (EN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="my-2" />

            <div className="flex items-center justify-between pt-1">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-foreground">
                  {t("settings.changePassword")}
                </span>
                <p className="text-[11px] text-muted-foreground">
                  อัปเดตรหัสผ่านเข้าสู่ระบบ (รอ API จัดการบัญชี)
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled
                className="gap-1.5 rounded-xl text-xs opacity-70"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <Badge
                  variant="outline"
                  className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[9px] px-1.5 py-0"
                >
                  TODO
                </Badge>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Notifications */}
        <Card className={CARD_CLASS}>
          <CardHeader className={CARD_HEADER_CLASS}>
            <div className="flex items-center justify-between">
              <CardTitle className={CARD_TITLE_CLASS}>
                <BellRing className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                {t("settings.notifications")}
              </CardTitle>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold rounded-full px-2"
              >
                Functional
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {t("settings.notificationsDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5 pt-4">
            <SettingSwitch
              id="notifyInApp"
              label={t("settings.notifyInApp")}
              description={t("settings.notifyInAppDesc")}
              checked={settings.notifyInApp}
              onCheckedChange={(checked) => updateSettings("notifyInApp", checked)}
            />

            <div className="space-y-2">
              <SettingSwitch
                id="notifySound"
                label={t("settings.notifySound")}
                description={t("settings.notifySoundDesc")}
                checked={settings.notifySound}
                onCheckedChange={(checked) => updateSettings("notifySound", checked)}
              />
              <div className="flex justify-end pl-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestSound}
                  className="gap-1.5 rounded-xl text-xs h-7 border-neutral-200/80 dark:border-neutral-800/80 shadow-2xs"
                >
                  <Volume2 className="h-3.5 w-3.5 text-amber-500" />
                  {t("settings.testSound")}
                </Button>
              </div>
            </div>

            <Separator className="my-2" />

            {/* TODO: Email Notification */}
            <SettingSwitch
              id="notifyEmail"
              label={t("settings.notifyEmail")}
              description={`${t("settings.notifyEmailDesc")} (รอเชื่อมต่อระบบ SMTP Mail Server)`}
              checked={settings.notifyEmail}
              onCheckedChange={(checked) => updateSettings("notifyEmail", checked)}
              disabled
              badge="TODO"
            />

            {/* TODO: Notification Digest */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="notifyDigest" className="text-xs font-medium">
                  {t("settings.notificationFormat")}
                </Label>
                <Badge
                  variant="outline"
                  className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[10px] font-semibold"
                >
                  TODO
                </Badge>
              </div>
              <Select
                value={settings.notifyDigest}
                onValueChange={(value) => updateSettings("notifyDigest", value)}
                disabled
              >
                <SelectTrigger
                  id="notifyDigest"
                  className="w-full rounded-xl border-neutral-200/80 dark:border-neutral-800/80 opacity-70"
                >
                  <SelectValue placeholder="เลือกรูปแบบ" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="instant">{t("settings.instant")}</SelectItem>
                  <SelectItem value="5min">{t("settings.every5Min")}</SelectItem>
                  <SelectItem value="daily">{t("settings.daily")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                ปัจจุบันส่งแจ้งเตือนแบบทันที (โหมดสรุปต้องรอระบบ Batch Digest Worker)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Real-time Display Settings */}
        <Card className={CARD_CLASS}>
          <CardHeader className={CARD_HEADER_CLASS}>
            <div className="flex items-center justify-between">
              <CardTitle className={CARD_TITLE_CLASS}>
                <Settings2 className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                {t("settings.realtimeDisplay")}
              </CardTitle>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold rounded-full px-2"
              >
                Functional
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {t("settings.realtimeDisplayDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="realtimeRows" className="text-xs font-medium">
                  {t("settings.recentItems")}
                </Label>
                <Select
                  value={settings.realtimeRows}
                  onValueChange={(value) => updateSettings("realtimeRows", value)}
                >
                  <SelectTrigger
                    id="realtimeRows"
                    className="w-full rounded-xl border-neutral-200/80 dark:border-neutral-800/80"
                  >
                    <SelectValue placeholder="จำนวนรายการ" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="10">10 รายการ</SelectItem>
                    <SelectItem value="20">20 รายการ</SelectItem>
                    <SelectItem value="50">50 รายการ</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  กำหนดจำนวนแถวสูงสุดในตาราง Real-time
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="refreshInterval" className="text-xs font-medium">
                    {t("settings.refreshInterval")}
                  </Label>
                  <Badge
                    variant="outline"
                    className="border-neutral-500/40 text-neutral-600 dark:text-neutral-400 bg-neutral-500/10 text-[10px] font-semibold"
                  >
                    N/A
                  </Badge>
                </div>
                <Select
                  value={settings.refreshInterval}
                  onValueChange={(value) => updateSettings("refreshInterval", value)}
                  disabled
                >
                  <SelectTrigger
                    id="refreshInterval"
                    className="w-full rounded-xl border-neutral-200/80 dark:border-neutral-800/80 opacity-70"
                  >
                    <SelectValue placeholder="เลือกช่วงเวลา" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="2">2 วินาที</SelectItem>
                    <SelectItem value="5">5 วินาที</SelectItem>
                    <SelectItem value="10">10 วินาที</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  ใช้ระบบ Push Real-time (SSE Stream) ไม่จำเป็นต้องตั้ง Refresh Polling
                </p>
              </div>
            </div>

            <Separator className="my-1" />

            <SettingSwitch
              id="showOnlyViolations"
              label={t("settings.showOnlyViolations")}
              description={t("settings.showOnlyViolationsDesc")}
              checked={settings.showOnlyViolations}
              onCheckedChange={(checked) => updateSettings("showOnlyViolations", checked)}
            />
          </CardContent>
        </Card>

        {/* Card 4: Admin Settings (Visible to admin) */}
        {role === "admin" ? (
          <Card className={`${CARD_CLASS} border-orange-500/30 dark:border-orange-500/20`}>
            <CardHeader className={CARD_HEADER_CLASS}>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-orange-600 dark:text-orange-400">
                  <ShieldCheck className="h-4 w-4 text-orange-500" />
                  {t("settings.adminSettings")}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[10px] font-semibold rounded-full px-2"
                >
                  TODO / Config File
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {t("settings.adminSettingsDesc")} — จัดการผ่าน backend config JSON / .env (รอระบบ Dynamic API)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cameraSource" className="flex items-center gap-2 text-xs font-medium">
                    <Camera className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                    {t("settings.cameraSource")}
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    config.development.json
                  </span>
                </div>
                <Input
                  id="cameraSource"
                  value={settings.cameraSource}
                  placeholder="rtsp://..."
                  disabled
                  readOnly
                  className="rounded-xl border-neutral-200/80 dark:border-neutral-800/80 bg-muted/40 text-muted-foreground"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="detectionThreshold" className="text-xs font-medium">
                    {t("settings.detectionThreshold")}
                  </Label>
                  <Input
                    id="detectionThreshold"
                    value={settings.detectionThreshold}
                    placeholder="0.50"
                    disabled
                    readOnly
                    className="rounded-xl border-neutral-200/80 dark:border-neutral-800/80 bg-muted/40 text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retentionDays" className="text-xs font-medium">
                    {t("settings.dataRetention")}
                  </Label>
                  <Input
                    id="retentionDays"
                    value={settings.retentionDays}
                    placeholder="30"
                    disabled
                    readOnly
                    className="rounded-xl border-neutral-200/80 dark:border-neutral-800/80 bg-muted/40 text-muted-foreground"
                  />
                </div>
              </div>

              <SettingSwitch
                id="snapshotEnabled"
                label={t("settings.snapshotEnabled")}
                description={t("settings.snapshotEnabledDesc")}
                checked={settings.snapshotEnabled}
                onCheckedChange={(checked) => updateSettings("snapshotEnabled", checked)}
                disabled
                badge="Config File"
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

type SettingSwitchProps = {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  badge?: string
}

function SettingSwitch({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  badge,
}: SettingSwitchProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-muted/30 hover:bg-muted/50 p-3.5 transition-colors">
      <div className="space-y-0.5 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="text-sm font-medium">
            {label}
          </Label>
          {badge ? (
            <Badge
              variant="outline"
              className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[9px] px-1.5 py-0 font-semibold"
            >
              {badge}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}

