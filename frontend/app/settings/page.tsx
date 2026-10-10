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
  createAuthHeadersFromStore,
  getStoredCurrentUser,
} from "@/stores/auth-store"
import { useLanguage } from "@/hooks/useLanguage"
import { playViolationBeep } from "@/lib/alert-sound"
import { API_BASE_URL } from "@/lib/api/config"
import {
  HELMET_SETTINGS_UPDATED_EVENT,
  STORAGE_KEY,
} from "@/lib/app-settings"
import {
  BellRing,
  Camera,
  Clock,
  KeyRound,
  Loader2,
  Mail,
  RotateCcw,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  UserRound,
  Volume2,
} from "lucide-react"
import { memo, startTransition, useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

export type AppSettings = {
  fullName: string
  email: string
  timezone: string
  language: string
  notifyInApp: boolean
  notifyEmail: boolean
  notifySound: boolean
  securityChiefEmail: string
  digestTime: string
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
  notifyEmail: true,
  notifySound: true,
  securityChiefEmail: "security-chief@university.ac.th",
  digestTime: "18:00",
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

interface FastInputProps extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> {
  value: string
  onValueChange: (val: string) => void
}

const FastInput = memo(function FastInput({
  value,
  onValueChange,
  ...props
}: FastInputProps) {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  return (
    <Input
      {...props}
      value={localValue}
      onChange={(event) => {
        const next = event.target.value
        setLocalValue(next)
        startTransition(() => {
          onValueChange(next)
        })
      }}
      onBlur={() => {
        if (localValue !== value) {
          onValueChange(localValue)
        }
      }}
    />
  )
})

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
          securityChiefEmail: user.email || prev.securityChiefEmail,
        }))
        return
      }

      const parsed = JSON.parse(raw) as Partial<AppSettings>
      setSettings({
        ...DEFAULT_SETTINGS,
        ...parsed,
        fullName: parsed.fullName || user.fullName || user.username || "",
        email: user.email || parsed.email || "",
        securityChiefEmail:
          parsed.securityChiefEmail || user.email || DEFAULT_SETTINGS.securityChiefEmail,
        digestTime: parsed.digestTime || DEFAULT_SETTINGS.digestTime,
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

  const [isSendingDigest, setIsSendingDigest] = useState(false)

  const updateSettings = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateFullName = useCallback((val: string) => {
    updateSettings("fullName", val)
  }, [updateSettings])

  const updateTimezone = useCallback((val: string) => {
    updateSettings("timezone", val)
  }, [updateSettings])

  const updateLanguage = useCallback((val: string) => {
    updateSettings("language", val)
    setLang(val as "th" | "en")
  }, [updateSettings, setLang])

  const saveSettings = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    window.dispatchEvent(new Event(HELMET_SETTINGS_UPDATED_EVENT))
    toast.success(t("settings.saveMessage") || "บันทึกการตั้งค่าเรียบร้อยแล้ว")
  }, [settings, t])

  const resetToDefaults = useCallback(() => {
    const resetValues: AppSettings = {
      ...DEFAULT_SETTINGS,
      fullName: currentUser.fullName || currentUser.username || "",
      email: currentUser.email || "",
      securityChiefEmail: currentUser.email || DEFAULT_SETTINGS.securityChiefEmail,
      digestTime: DEFAULT_SETTINGS.digestTime,
      language: activeLanguage,
    }
    setSettings(resetValues)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resetValues))
    window.dispatchEvent(new Event(HELMET_SETTINGS_UPDATED_EVENT))
    toast.info(t("settings.resetMessage") || "คืนค่าเริ่มต้นเรียบร้อยแล้ว")
  }, [currentUser, activeLanguage, t])

  const handleTestSound = useCallback(() => {
    playViolationBeep()
    toast.info(t("settings.testSound") || "ทดสอบเสียงแจ้งเตือน (Beep)")
  }, [t])

  const handleTestSendDigest = useCallback(async () => {
    const targetEmail = settings.securityChiefEmail.trim() || settings.email.trim()
    if (!targetEmail) {
      toast.error(t("settings.recipientRequired") || "กรุณาระบุอีเมลหัวหน้ารปภ. ก่อนทดสอบส่ง")
      return
    }

    setIsSendingDigest(true)
    try {
      const res = await fetch(`${API_BASE_URL}/helmet/send-digest`, {
        method: "POST",
        headers: {
          ...createAuthHeadersFromStore(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipient_email: targetEmail }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || t("settings.testSendDigestError"))
      }

      if (data.status === "dry_run") {
        toast.info(data.message || `${t("settings.testSendDigestSuccess")} (Dry-Run: ยังไม่ได้ตั้งค่า SMTP Host)`)
      } else {
        toast.success(data.message || `${t("settings.testSendDigestSuccess")}: ${targetEmail}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("settings.testSendDigestError")
      toast.error(`${t("settings.testSendDigestError")}: ${msg}`)
    } finally {
      setIsSendingDigest(false)
    }
  }, [settings.securityChiefEmail, settings.email, t])

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
        <UserProfileCard
          fullName={settings.fullName}
          email={currentUser.email || settings.email}
          timezone={settings.timezone}
          activeLanguage={activeLanguage}
          placeholderName={currentUser.fullName || currentUser.username || "ผู้ใช้งาน"}
          onUpdateFullName={updateFullName}
          onUpdateTimezone={updateTimezone}
          onUpdateLanguage={updateLanguage}
          t={t}
        />

        <NotificationsCard
          notifyInApp={settings.notifyInApp}
          notifySound={settings.notifySound}
          notifyEmail={settings.notifyEmail}
          securityChiefEmail={settings.securityChiefEmail}
          digestTime={settings.digestTime}
          isSendingDigest={isSendingDigest}
          onUpdate={updateSettings}
          onTestSound={handleTestSound}
          onTestSendDigest={handleTestSendDigest}
          t={t}
        />

        <RealtimeDisplayCard
          realtimeRows={settings.realtimeRows}
          refreshInterval={settings.refreshInterval}
          showOnlyViolations={settings.showOnlyViolations}
          onUpdate={updateSettings}
          t={t}
        />

        {role === "admin" ? (
          <AdminSettingsCard
            cameraSource={settings.cameraSource}
            detectionThreshold={settings.detectionThreshold}
            retentionDays={settings.retentionDays}
            snapshotEnabled={settings.snapshotEnabled}
            onUpdate={updateSettings}
            t={t}
          />
        ) : null}
      </div>
    </div>
  )
}

type UserProfileCardProps = {
  fullName: string
  email: string
  timezone: string
  activeLanguage: string
  placeholderName: string
  onUpdateFullName: (value: string) => void
  onUpdateTimezone: (value: string) => void
  onUpdateLanguage: (value: string) => void
  t: (key: string) => string
}

const UserProfileCard = memo(function UserProfileCard({
  fullName,
  email,
  timezone,
  activeLanguage,
  placeholderName,
  onUpdateFullName,
  onUpdateTimezone,
  onUpdateLanguage,
  t,
}: UserProfileCardProps) {
  return (
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
          <FastInput
            id="fullName"
            value={fullName}
            onValueChange={onUpdateFullName}
            placeholder={placeholderName}
            className="rounded-xl border-neutral-200/80 dark:border-neutral-800/80"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="email" className="text-xs font-medium">
              {t("settings.email")}
            </Label>
            <span className="text-[11px] text-muted-foreground">
              {t("settings.accountVerified") || "(ระบบยืนยันจากบัญชีผู้ใช้)"}
            </span>
          </div>
          <Input
            id="email"
            value={email}
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
              value={timezone}
              onValueChange={onUpdateTimezone}
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
              onValueChange={onUpdateLanguage}
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
  )
})

type NotificationsCardProps = {
  notifyInApp: boolean
  notifySound: boolean
  notifyEmail: boolean
  securityChiefEmail: string
  digestTime: string
  isSendingDigest: boolean
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  onTestSound: () => void
  onTestSendDigest: () => void
  t: (key: string) => string
}

const NotificationsCard = memo(function NotificationsCard({
  notifyInApp,
  notifySound,
  notifyEmail,
  securityChiefEmail,
  digestTime,
  isSendingDigest,
  onUpdate,
  onTestSound,
  onTestSendDigest,
  t,
}: NotificationsCardProps) {
  return (
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
          checked={notifyInApp}
          onCheckedChange={(checked) => onUpdate("notifyInApp", checked)}
        />

        <div className="space-y-2">
          <SettingSwitch
            id="notifySound"
            label={t("settings.notifySound")}
            description={t("settings.notifySoundDesc")}
            checked={notifySound}
            onCheckedChange={(checked) => onUpdate("notifySound", checked)}
          />
          <div className="flex justify-end pl-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onTestSound}
              className="gap-1.5 rounded-xl text-xs h-7 border-neutral-200/80 dark:border-neutral-800/80 shadow-2xs"
            >
              <Volume2 className="h-3.5 w-3.5 text-amber-500" />
              {t("settings.testSound")}
            </Button>
          </div>
        </div>

        <Separator className="my-2" />

        {/* Daily Summary Digest for Security Chief */}
        <div className="space-y-3 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-neutral-50/50 dark:bg-neutral-900/30 p-3.5">
          <SettingSwitch
            id="notifyEmail"
            label={t("settings.dailyDigest")}
            description={t("settings.dailyDigestDesc")}
            checked={notifyEmail}
            onCheckedChange={(checked) => onUpdate("notifyEmail", checked)}
          />

          {notifyEmail && (
            <div className="space-y-3 pt-2 border-t border-neutral-200/50 dark:border-neutral-800/50">
              <p className="text-[11px] text-muted-foreground">
                {t("settings.scheduledDigestServerNote") || "หมายเหตุ: ระบบส่งรายงานอัตโนมัติประจำวันทำงานตามการตั้งค่าบน Server (config.development.json / .env)"}
              </p>
              <div className="space-y-1.5">
                <Label
                  htmlFor="securityChiefEmail"
                  className="text-xs font-medium flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300"
                >
                  <Mail className="h-3.5 w-3.5 text-blue-500" />
                  {t("settings.securityChiefEmail")}
                </Label>
                <FastInput
                  id="securityChiefEmail"
                  type="email"
                  placeholder="security-chief@university.ac.th"
                  value={securityChiefEmail}
                  onValueChange={(val) => onUpdate("securityChiefEmail", val)}
                  className="h-8 rounded-xl border-neutral-200/80 dark:border-neutral-800/80 text-xs bg-white dark:bg-neutral-950"
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("settings.securityChiefEmailDesc")}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="digestTime"
                  className="text-xs font-medium flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300"
                >
                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                  {t("settings.digestTime")}
                </Label>
                <Select
                  value={digestTime}
                  onValueChange={(value) => onUpdate("digestTime", value)}
                >
                  <SelectTrigger
                    id="digestTime"
                    className="h-8 w-full rounded-xl border-neutral-200/80 dark:border-neutral-800/80 text-xs bg-white dark:bg-neutral-950"
                  >
                    <SelectValue placeholder="เลือกเวลาส่งรายงาน" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="18:00">{t("settings.shiftDay") || "18:00 น. (สิ้นสุดกะกลางวัน)"}</SelectItem>
                    <SelectItem value="20:00">{t("settings.shiftEvening") || "20:00 น. (สิ้นสุดกะค่ำ)"}</SelectItem>
                    <SelectItem value="08:00">{t("settings.shiftNight") || "08:00 น. (สิ้นสุดกะดึก)"}</SelectItem>
                    <SelectItem value="12:00">{t("settings.shiftNoon") || "12:00 น. (กะเที่ยงวัน)"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSendingDigest}
                  onClick={onTestSendDigest}
                  className="gap-1.5 rounded-xl text-xs h-8 border-neutral-200/80 dark:border-neutral-800/80 shadow-2xs hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30"
                >
                  {isSendingDigest ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                  ) : (
                    <Send className="h-3.5 w-3.5 text-blue-500" />
                  )}
                  {isSendingDigest ? t("settings.sendingDigest") : t("settings.testSendDigest")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})

type RealtimeDisplayCardProps = {
  realtimeRows: string
  refreshInterval: string
  showOnlyViolations: boolean
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  t: (key: string) => string
}

const RealtimeDisplayCard = memo(function RealtimeDisplayCard({
  realtimeRows,
  refreshInterval,
  showOnlyViolations,
  onUpdate,
  t,
}: RealtimeDisplayCardProps) {
  return (
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
              value={realtimeRows}
              onValueChange={(value) => onUpdate("realtimeRows", value)}
            >
              <SelectTrigger
                id="realtimeRows"
                className="w-full rounded-xl border-neutral-200/80 dark:border-neutral-800/80"
              >
                <SelectValue placeholder="จำนวนรายการ" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="10">{t("settings.itemsCount")?.replace("{count}", "10") || "10 รายการ"}</SelectItem>
                <SelectItem value="20">{t("settings.itemsCount")?.replace("{count}", "20") || "20 รายการ"}</SelectItem>
                <SelectItem value="50">{t("settings.itemsCount")?.replace("{count}", "50") || "50 รายการ"}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {t("settings.maxRealtimeRowsDesc") || "กำหนดจำนวนแถวสูงสุดในตาราง Real-time"}
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
              value={refreshInterval}
              onValueChange={(value) => onUpdate("refreshInterval", value)}
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
              {t("settings.pushRealtimeDesc") || "ใช้ระบบ Push Real-time (SSE Stream) ไม่จำเป็นต้องตั้ง Refresh Polling"}
            </p>
          </div>
        </div>

        <Separator className="my-1" />

        <SettingSwitch
          id="showOnlyViolations"
          label={t("settings.showOnlyViolations")}
          description={t("settings.showOnlyViolationsDesc")}
          checked={showOnlyViolations}
          onCheckedChange={(checked) => onUpdate("showOnlyViolations", checked)}
        />
      </CardContent>
    </Card>
  )
})

type AdminSettingsCardProps = {
  cameraSource: string
  detectionThreshold: string
  retentionDays: string
  snapshotEnabled: boolean
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  t: (key: string) => string
}

const AdminSettingsCard = memo(function AdminSettingsCard({
  cameraSource,
  detectionThreshold,
  retentionDays,
  snapshotEnabled,
  onUpdate,
  t,
}: AdminSettingsCardProps) {
  return (
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
            value={cameraSource}
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
              value={detectionThreshold}
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
              value={retentionDays}
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
          checked={snapshotEnabled}
          onCheckedChange={(checked) => onUpdate("snapshotEnabled", checked)}
          disabled
          badge="Config File"
        />
      </CardContent>
    </Card>
  )
})

type SettingSwitchProps = {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  badge?: string
}

const SettingSwitch = memo(function SettingSwitch({
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
              className="border-neutral-300 dark:border-neutral-700 text-muted-foreground text-[9px] px-1.5 py-0 font-medium"
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
})

