import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy - Krypta",
  description: "Privacy policy for Krypta.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-sf-bg-primary py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center text-sm text-sf-text-secondary hover:text-sf-accent mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
        
        <div className="bg-white rounded-[32px] border border-black/5 p-8 sm:p-12 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_24px_60px_-36px_rgba(35,36,39,0.3)]">
          <h1 className="text-4xl font-bold text-sf-text-primary mb-6">Privacy Policy</h1>
          <p className="text-sf-text-secondary mb-8">Last updated: {new Date().toLocaleDateString()}</p>
          
          <div className="space-y-8 text-sf-text-secondary leading-relaxed">
            <section>
              <h2 className="text-2xl font-semibold text-sf-text-primary mb-4">1. Information We Collect</h2>
              <p>
                We collect information to provide better services to all our users. The types of information we collect include:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-2">
                <li><strong>Information you give us:</strong> When you sign up for Krypta, we ask for personal information, like your name, email address, and GitHub account details.</li>
                <li><strong>Information we get from your use of our services:</strong> We collect information about the repositories you connect and the scans we run, including vulnerability reports.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-sf-text-primary mb-4">2. How We Use Information</h2>
              <p>
                We use the information we collect from all of our services to provide, maintain, protect and improve them, to develop new ones, and to protect Krypta and our users. We also use this information to offer you tailored content – like giving you more relevant scan results.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-sf-text-primary mb-4">3. Information We Share</h2>
              <p>
                We do not share personal information with companies, organizations and individuals outside of Krypta unless one of the following circumstances applies:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-2">
                <li>With your consent.</li>
                <li>For external processing by our trusted partners.</li>
                <li>For legal reasons if we have a good-faith belief that access, use, preservation or disclosure of the information is reasonably necessary.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-sf-text-primary mb-4">4. Information Security</h2>
              <p>
                We work hard to protect Krypta and our users from unauthorized access to or unauthorized alteration, disclosure or destruction of information we hold. In particular:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-2">
                <li>We encrypt many of our services using SSL.</li>
                <li>We review our information collection, storage and processing practices, including physical security measures, to guard against unauthorized access to systems.</li>
                <li>We restrict access to personal information to Krypta employees, contractors and agents who need to know that information in order to process it for us.</li>
              </ul>
            </section>
            
            <section>
              <h2 className="text-2xl font-semibold text-sf-text-primary mb-4">5. Changes to This Policy</h2>
              <p>
                Our Privacy Policy may change from time to time. We will not reduce your rights under this Privacy Policy without your explicit consent. We will post any privacy policy changes on this page and, if the changes are significant, we will provide a more prominent notice.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
