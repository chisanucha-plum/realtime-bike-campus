"use client"

import {
  AlertTriangle,
  BadgeAlert,
  Bell,
  Bike,
  Camera,
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Headphones,
  HelpCircle,
  Mail,
  MapPin,
  Phone,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  Volume2,
} from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/hooks/useLanguage"

export default function HelpPage() {
  const { t } = useLanguage("en")

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium text-emerald-300 border border-white/10">
            <Sparkles className="h-3.5 w-3.5" />
            <span>KMUTT Smart Campus Safety</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {t("sidebar.helpDesc")} & ข้อมูลระบบ
          </h1>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            คู่มือการใช้งานระบบตรวจจับหมวกกันน็อคและพฤติกรรมการขับขี่อัจฉริยะแบบ Real-time
            สำหรับเจ้าหน้าที่รักษาความปลอดภัยและผู้ดูแลระบบ
          </p>
        </div>

        {/* Decorative background circle */}
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Grid of Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {/* Card 1: AI Detection Pipeline */}
        <Card className="rounded-2xl border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-[#18181A]/90 backdrop-blur-xl shadow-xs">
          <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800/60">
            <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-foreground">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                <Bike className="h-4 w-4" />
              </div>
              การทำงานของระบบ AI (2-Stage Pipeline)
            </CardTitle>
            <CardDescription className="text-xs">
              สถาปัตยกรรมโมเดล Deep Learning ความแม่นยำสูงและประหยัดพลังงาน
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3.5 text-xs text-muted-foreground leading-relaxed">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center font-bold text-foreground flex-shrink-0 text-[11px]">
                1
              </div>
              <div>
                <p className="font-semibold text-foreground text-xs">Motorcycle Tracking (Stage 1)</p>
                <p className="mt-0.5">
                  ระบบตรวจจับและติดตามรถมอเตอร์ไซค์ที่เคลื่อนที่เข้ามาในพื้นที่ พร้อมติดตามทิศทางและความเร็ว
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center font-bold text-foreground flex-shrink-0 text-[11px]">
                2
              </div>
              <div>
                <p className="font-semibold text-foreground text-xs">Evaluation Window (Stage 2)</p>
                <p className="mt-0.5">
                  เมื่อรถแตะเส้นตัด ระบบจะเปิดหน้าต่างประเมินผล 3 เฟรม เพื่อเลือกเฟรมที่คมชัดที่สุด ลดผลกระทบจากภาพเบลอ (Motion Blur) และแสงสะท้อน
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center font-bold text-foreground flex-shrink-0 text-[11px]">
                3
              </div>
              <div>
                <p className="font-semibold text-foreground text-xs">Early Exit & Safety Snapshot</p>
                <p className="mt-0.5">
                  หากตรวจพบความมั่นใจสูง ({`\u2265`} 70%) ระบบจะสรุปผลทันทีเพื่อความรวดเร็ว และบันทึกภาพถ่ายหลักฐาน (Snapshot) ลงฐานข้อมูล
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Status & Badges Guide */}
        <Card className="rounded-2xl border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-[#18181A]/90 backdrop-blur-xl shadow-xs">
          <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800/60">
            <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-foreground">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              สัญลักษณ์และสถานะการตรวจจับ
            </CardTitle>
            <CardDescription className="text-xs">
              คำอธิบายสีและป้ายแสดงสถานะบนหน้าจอถ่ายทอดสดและประวัติย้อนหลัง
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-3">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                  สวมหมวกนิรภัย (Compliant)
                </p>
                <p className="text-muted-foreground mt-0.5">
                  ผู้ขับขี่และผู้ซ้อนท้ายทุกคนสวมหมวกนิรภัยถูกต้องตามกฎความปลอดภัย
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold text-rose-700 dark:text-rose-300">
                  ไม่สวมหมวกนิรภัย / ฝ่าฝืน (Violation)
                </p>
                <p className="text-muted-foreground mt-0.5">
                  ตรวจพบผู้ขับขี่หรือผู้ซ้อนท้ายอย่างน้อย 1 คนไม่สวมหมวก ระบบจะส่งเสียงแจ้งเตือนและบันทึกภาพหลักฐาน
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
              <Users className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold text-amber-700 dark:text-amber-300">
                  นั่งเกิน 2 คน (Over Capacity)
                </p>
                <p className="text-muted-foreground mt-0.5">
                  จำนวนผู้โดยสารบนรถมอเตอร์ไซค์มากกว่า 2 คน ซึ่งผิดกฎจราจรและความปลอดภัย
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Key Features & Operator Tips */}
        <Card className="rounded-2xl border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-[#18181A]/90 backdrop-blur-xl shadow-xs">
          <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800/60">
            <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-foreground">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                <Volume2 className="h-4 w-4" />
              </div>
              คำแนะนำและเทคนิคการใช้งานด่วน
            </CardTitle>
            <CardDescription className="text-xs">
              ฟังก์ชันลัดเพื่อความคล่องตัวในการปฏิบัติงานของเจ้าหน้าที่
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs text-muted-foreground">
            <div className="flex items-start gap-2.5">
              <Volume2 className="h-4 w-4 text-foreground flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">เปิด/ปิดเสียงเตือนด่วน:</span>{" "}
                สามารถกดไอคอนรูปลำโพงบนหน้า Real-time เพื่อ Mute/Unmute เสียง Beep แจ้งเตือนได้ทันทีโดยไม่ต้องไปหน้าตั้งค่า
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Download className="h-4 w-4 text-foreground flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">ดาวน์โหลดภาพหลักฐาน:</span>{" "}
                คลิกที่รายการตรวจจับใดก็ได้เพื่อเปิดหน้าต่างดูภาพขยาย จากนั้นกดปุ่ม "ดาวน์โหลดรูปหลักฐาน" เพื่อนำไปทำบันทึกรายงาน
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <FileSpreadsheet className="h-4 w-4 text-foreground flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">ส่งออกข้อมูล CSV:</span>{" "}
                ไปที่หน้า <Link href="/history" className="text-primary hover:underline font-medium">ประวัติย้อนหลัง</Link> เพื่อดาวน์โหลดไฟล์ Excel/CSV ที่มีรหัส Track ID วันเวลา และสถานะครบถ้วน
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-foreground flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">ปุ่ม ESC บนแป้นพิมพ์:</span>{" "}
                ใช้กดปิดหน้าต่างภาพขยาย (Modal) หรือออกจากโหมดเต็มจอได้ทันที
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Support & Security Contact */}
        <Card className="rounded-2xl border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-[#18181A]/90 backdrop-blur-xl shadow-xs">
          <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800/60">
            <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-foreground">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
                <Headphones className="h-4 w-4" />
              </div>
              ศูนย์ควบคุมและช่องทางติดต่อ
            </CardTitle>
            <CardDescription className="text-xs">
              หน่วยงานรักษาความปลอดภัย มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3.5 text-xs">
            <div className="p-3 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/50 flex items-start gap-3">
              <MapPin className="h-4 w-4 text-neutral-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">ศูนย์ควบคุมระบบกล้องวงจรปิด มจธ.</p>
                <p className="text-muted-foreground mt-0.5">
                  อาคารปฏิบัติการทางวิทยาศาสตร์ (S13) ชั้น 1 วิทยาเขตบางมด
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/50 flex items-start gap-3">
              <Phone className="h-4 w-4 text-neutral-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">เบอร์โทรศัพท์ฉุกเฉิน / รปภ.</p>
                <p className="text-muted-foreground mt-0.5">
                  โทร: <span className="font-mono text-foreground font-semibold">02-470-8000</span> หรือสายภายใน <span className="font-mono text-foreground font-semibold">8000</span>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-muted-foreground text-[11px]">ต้องการปรับค่าระบบ?</span>
              <Button asChild size="sm" variant="outline" className="rounded-xl h-8 text-xs gap-1.5">
                <Link href="/settings">
                  <span>ไปยังหน้าตั้งค่า</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
