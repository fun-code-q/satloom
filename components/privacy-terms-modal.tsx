"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Shield } from "lucide-react"

interface PrivacyTermsModalProps {
    isOpen: boolean
    onClose: () => void
    type: "privacy" | "terms"
}

export function PrivacyTermsModal({ isOpen, onClose, type }: PrivacyTermsModalProps) {
    const isPrivacy = type === "privacy"

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-slate-800 border-slate-700 text-white w-full max-w-2xl mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl text-cyan-400">
                        {isPrivacy ? <ShieldCheck className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
                        {isPrivacy ? "Privacy Policy" : "Terms of Service"}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4 text-gray-300 leading-relaxed">
                    <section>
                        <h3 className="text-white font-medium mb-2">1. Overview</h3>
                        <p>
                            This is a placeholder for the {isPrivacy ? "Privacy Policy" : "Terms of Service"}.
                            In a real application, this section would contain detailed information about
                            how we handle your data and the rules for using our platform.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-white font-medium mb-2">2. Data Collection</h3>
                        <p>
                            We prioritize your privacy and aim to collect only the minimum data necessary
                            to provide our services. This includes ephemeral session data and encrypted
                            messages that we do not store indefinitely.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-white font-medium mb-2">3. User Conduct</h3>
                        <p>
                            Users are expected to behave respectfully and adhere to community guidelines.
                            Any form of harassment or illegal activity is strictly prohibited.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-white font-medium mb-2">4. Security</h3>
                        <p>
                            We use industry-standard encryption to protect your communications. However,
                            no system is 100% secure, and we encourage users to take precautions.
                        </p>
                    </section>
                </div>

                <div className="flex justify-end pt-4">
                    <Button onClick={onClose} className="bg-cyan-500 hover:bg-cyan-600 text-white">
                        I Understand
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
