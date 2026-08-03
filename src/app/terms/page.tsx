import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms and Conditions - Krypta",
  description: "Terms and conditions for using Krypta.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-sf-bg-primary py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center text-sm text-sf-text-secondary hover:text-sf-accent mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
        
        <div className="bg-white rounded-[32px] border border-black/5 p-8 sm:p-12 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_24px_60px_-36px_rgba(35,36,39,0.3)]">
          <h1 className="text-4xl font-bold text-sf-text-primary mb-6">Terms and Conditions</h1>
          <p className="text-sf-text-secondary mb-8">Last updated: {new Date().toLocaleDateString()}</p>
          
          <div className="space-y-8 text-sf-text-secondary leading-relaxed">
            <section>
              <h2 className="text-2xl font-semibold text-sf-text-primary mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using Krypta, you accept and agree to be bound by the terms and provision of this agreement. 
                In addition, when using these particular services, you shall be subject to any posted guidelines or rules applicable to such services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-sf-text-primary mb-4">2. Description of Service</h2>
              <p>
                Krypta provides AI-powered security scanning services for GitHub repositories. You understand and agree that the Service is provided &quot;AS-IS&quot; and that Krypta assumes no responsibility for the timeliness, deletion, mis-delivery or failure to store any user communications or personalization settings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-sf-text-primary mb-4">3. User Conduct</h2>
              <p>
                You agree not to use the Service to:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-2">
                <li>Upload, post, email, transmit or otherwise make available any content that is unlawful, harmful, threatening, abusive, harassing, tortious, defamatory, vulgar, obscene, libelous, invasive of another&apos;s privacy, hateful, or racially, ethnically or otherwise objectionable;</li>
                <li>Impersonate any person or entity, or falsely state or otherwise misrepresent your affiliation with a person or entity;</li>
                <li>Interfere with or disrupt the Service or servers or networks connected to the Service.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-sf-text-primary mb-4">4. Privacy Policy</h2>
              <p>
                Registration data and certain other information about you is subject to our Privacy Policy. For more information, see our full <Link href="/privacy" className="text-sf-accent hover:underline">Privacy Policy</Link>.
              </p>
            </section>
            
            <section>
              <h2 className="text-2xl font-semibold text-sf-text-primary mb-4">5. Disclaimer of Warranties</h2>
              <p>
                You expressly understand and agree that your use of the service is at your sole risk. The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. Krypta expressly disclaims all warranties of any kind, whether express or implied.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
