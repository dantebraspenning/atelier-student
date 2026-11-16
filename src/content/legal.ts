// DRAFT legal texts — have them reviewed by a Dutch lawyer before launch.
// Placeholders in {braces} are filled from the COMPANY_* environment variables.

export type LegalDoc = { title: string; sections: { h: string; p: string[] }[] };
export const LEGAL_UPDATED = '2026-11-16';

export const LEGAL: Record<'terms' | 'privacy' | 'cookies' | 'imprint', Record<'nl' | 'en', LegalDoc>> = {
  terms: {
    en: {
      title: 'Terms of use',
      sections: [
        { h: '1. Who we are and what we do', p: ['Atelier Student is operated by {company} ({address}, Chamber of Commerce {kvk}). We run an online marketplace where customers ask fashion students (“makers”) to make clothing to measure. We are not a party to the agreement for the piece itself: that agreement is between the customer and the maker. We provide the platform, hold payments, and help when something goes wrong.'] },
        { h: '2. Accounts', p: ['You must be at least 16 years old and give accurate information. Keep your password secret; you are responsible for activity on your account. Makers must be enrolled at a fashion or textile education programme and complete verification, tax details and payout setup before they can quote.'] },
        { h: '3. Requests and quotes', p: ['A quote states the price (making, fabric and shipping), the handover method, whether one alteration round is included, and an expected ready date. A quote is binding once the customer accepts and pays it.'] },
        { h: '4. Payment, holding and release', p: ['The customer pays the full quote when accepting it. Payments are processed by our payment provider (Stripe) and held until the customer confirms receipt. If the customer neither confirms, asks for an included alteration nor reports a problem within {days} days after the maker marks the piece as handed over or shipped, the payment is released automatically. On release, the maker receives the amount minus the platform fee shown in the studio ({fee}%).'] },
        { h: '5. Made to measure: no right of withdrawal', p: ['Pieces are made to the customer’s specifications. Under Dutch and EU consumer law the 14-day right of withdrawal therefore does not apply (article 6:230p sub f Dutch Civil Code). This does not affect your rights if a piece is not as agreed.'] },
        { h: '6. Alterations, cancellation and problems', p: ['If the quote includes an alteration round, the customer can request it once after handover; the payment stays held until the piece is back with the customer. While a piece is being made, either side may propose to cancel with a refund amount that the other side can accept. A maker who cannot finish refunds the customer in full. Customers can report a problem; payment is then frozen and our team decides, after hearing both sides, to release, refund or split the payment. We aim to respond within 2 working days.'] },
        { h: '7. Rules for everyone', p: ['Do not ask for or make payments outside Atelier Student for commissions found here; such payments are not protected. Do not harass others, post unlawful or infringing content, or misuse personal data you receive (such as measurements). Anyone can report content or users; we may hide content or suspend accounts that break these rules.'] },
        { h: '8. Makers: taxes and reporting', p: ['Makers are responsible for their own income tax and, where applicable, VAT. Under EU directive 2021/514 (DAC7) we report makers’ identification details and earnings to the Dutch Tax Administration once a year.'] },
        { h: '9. Content and portfolio', p: ['You keep the rights to photos and text you upload. You give us a non-exclusive licence to show them on the platform for the purpose of providing the service. Makers may show completed commissions in their portfolio; customers can ask a maker not to show photos in which they are recognisable.'] },
        { h: '10. Liability', p: ['We are not liable for the quality of pieces made by makers, but we handle disputes as described above. Our liability is limited to the platform fees paid for the commission concerned, except in case of intent or gross negligence. Customers who supply their own fabric or garments do so at their own risk, unless the maker is at fault.'] },
        { h: '11. Changes, law and disputes', p: ['We may change these terms; we announce material changes at least 30 days in advance. Dutch law applies. Consumers may also use the EU Online Dispute Resolution platform. Contact: {email}.'] }
      ]
    },
    nl: {
      title: 'Gebruiksvoorwaarden',
      sections: [
        { h: '1. Wie we zijn en wat we doen', p: ['Atelier Student wordt geëxploiteerd door {company} ({address}, KvK {kvk}). Wij exploiteren een online marktplaats waar klanten modestudenten (“makers”) vragen kleding op maat te maken. Wij zijn geen partij bij de overeenkomst voor het stuk zelf: die overeenkomst sluiten klant en maker met elkaar. Wij leveren het platform, houden betalingen vast en helpen als er iets misgaat.'] },
        { h: '2. Accounts', p: ['Je moet minstens 16 jaar zijn en juiste gegevens opgeven. Houd je wachtwoord geheim; je bent verantwoordelijk voor activiteit op je account. Makers moeten ingeschreven staan bij een mode- of textielopleiding en verificatie, belastinggegevens en uitbetaling hebben ingesteld voordat ze een offerte kunnen sturen.'] },
        { h: '3. Aanvragen en offertes', p: ['Een offerte vermeldt de prijs (maken, stof en verzending), de manier van overhandigen, of er één aanpassingsronde is inbegrepen en een verwachte klaardatum. Een offerte is bindend zodra de klant hem accepteert en betaalt.'] },
        { h: '4. Betalen, vasthouden en vrijgeven', p: ['De klant betaalt het volledige bedrag bij het accepteren van de offerte. Betalingen worden verwerkt door onze betaaldienst (Stripe) en vastgehouden tot de klant de ontvangst bevestigt. Als de klant binnen {days} dagen nadat de maker het stuk als overhandigd of verzonden heeft gemarkeerd niet bevestigt, geen inbegrepen aanpassing vraagt en geen probleem meldt, wordt de betaling automatisch vrijgegeven. Bij vrijgave ontvangt de maker het bedrag minus de platformkosten die in de studio staan ({fee}%).'] },
        { h: '5. Maatwerk: geen herroepingsrecht', p: ['Stukken worden gemaakt volgens de specificaties van de klant. Het herroepingsrecht van 14 dagen geldt daarom niet (artikel 6:230p sub f BW). Dit doet niets af aan je rechten als een stuk niet is zoals afgesproken.'] },
        { h: '6. Aanpassingen, annulering en problemen', p: ['Bevat de offerte een aanpassingsronde, dan kan de klant die eenmaal na overhandiging aanvragen; de betaling blijft vaststaan tot het stuk weer bij de klant is. Zolang een stuk wordt gemaakt, kan elke partij voorstellen te annuleren met een terugbetaling die de andere partij kan accepteren. Een maker die niet kan afronden, betaalt de klant volledig terug. Klanten kunnen een probleem melden; de betaling wordt dan bevroren en ons team besluit, na beide kanten te hebben gehoord, om de betaling vrij te geven, terug te betalen of te verdelen. We streven ernaar binnen 2 werkdagen te reageren.'] },
        { h: '7. Regels voor iedereen', p: ['Vraag of doe geen betalingen buiten Atelier Student voor opdrachten die je hier vindt; zulke betalingen zijn niet beschermd. Val anderen niet lastig, plaats geen onrechtmatige of inbreukmakende inhoud en misbruik geen persoonsgegevens die je ontvangt (zoals maten). Iedereen kan inhoud of gebruikers melden; we kunnen inhoud verbergen of accounts blokkeren die deze regels overtreden.'] },
        { h: '8. Makers: belasting en meldplicht', p: ['Makers zijn zelf verantwoordelijk voor hun inkomstenbelasting en, waar van toepassing, btw. Op grond van EU-richtlijn 2021/514 (DAC7) geven wij jaarlijks de identificatiegegevens en inkomsten van makers door aan de Belastingdienst.'] },
        { h: '9. Inhoud en portfolio', p: ['Je behoudt de rechten op foto’s en teksten die je uploadt. Je geeft ons een niet-exclusieve licentie om ze op het platform te tonen om de dienst te leveren. Makers mogen afgeronde opdrachten in hun portfolio tonen; klanten kunnen een maker vragen geen foto’s te tonen waarop zij herkenbaar zijn.'] },
        { h: '10. Aansprakelijkheid', p: ['Wij zijn niet aansprakelijk voor de kwaliteit van stukken die makers maken, maar behandelen geschillen zoals hierboven beschreven. Onze aansprakelijkheid is beperkt tot de platformkosten van de betreffende opdracht, behalve bij opzet of grove nalatigheid. Klanten die eigen stof of kleding aanleveren doen dat op eigen risico, tenzij de maker verwijtbaar handelt.'] },
        { h: '11. Wijzigingen, recht en geschillen', p: ['We kunnen deze voorwaarden wijzigen; belangrijke wijzigingen kondigen we minstens 30 dagen vooraf aan. Nederlands recht is van toepassing. Consumenten kunnen ook het Europese ODR-platform gebruiken. Contact: {email}.'] }
      ]
    }
  },
  privacy: {
    en: {
      title: 'Privacy policy',
      sections: [
        { h: 'Controller', p: ['{company}, {address}, is responsible for processing your personal data. Contact: {email}.'] },
        { h: 'What we process and why', p: [
          'Account data (name, email, password hash, language) — to provide your account (performance of contract).',
          'Requests, measurements, photos and messages — to let makers quote on and make your piece (performance of contract). Measurements are only shown to makers who can see your request.',
          'Maker profile, portfolio and reviews — shown publicly to help customers choose (performance of contract).',
          'Payment data — processed by Stripe; we only store references and amounts (performance of contract, legal bookkeeping obligation).',
          'Makers’ tax details (legal name, date of birth, address, BSN/TIN) — required by DAC7 (legal obligation). The tax number is encrypted at rest and only used for the yearly report.',
          'Security logs and reports — to prevent fraud and abuse (legitimate interest).'
        ] },
        { h: 'Who we share it with', p: ['Hosting and database provider, email delivery provider, photo storage provider and Stripe (payments and maker identity checks) act as our processors or as independent controllers for payments. The Dutch Tax Administration receives DAC7 data. We do not sell personal data and do not use advertising trackers.'] },
        { h: 'How long we keep it', p: ['Account and profile data until you delete your account. Payment and commission records for 7 years (Dutch fiscal retention). DAC7 data for the period required by law. Unused photo uploads are deleted after one day. Deleted accounts are anonymised; messages you sent are emptied.'] },
        { h: 'Your rights', p: ['You can view and download your data (Account → Download my data), correct it, delete your account, and object to or restrict processing. You can complain to the Autoriteit Persoonsgegevens.'] },
        { h: 'Security', p: ['Passwords are hashed, connections are encrypted, photos are re-encoded to remove location metadata, and access to requests, messages and photos is checked on every request.'] }
      ]
    },
    nl: {
      title: 'Privacybeleid',
      sections: [
        { h: 'Verwerkingsverantwoordelijke', p: ['{company}, {address}, is verantwoordelijk voor de verwerking van je persoonsgegevens. Contact: {email}.'] },
        { h: 'Wat we verwerken en waarom', p: [
          'Accountgegevens (naam, e-mail, wachtwoordhash, taal) — om je account te leveren (uitvoering overeenkomst).',
          'Aanvragen, maten, foto’s en berichten — zodat makers een offerte kunnen maken en je stuk kunnen maken (uitvoering overeenkomst). Maten zijn alleen zichtbaar voor makers die je aanvraag kunnen zien.',
          'Makersprofiel, portfolio en reviews — openbaar getoond zodat klanten kunnen kiezen (uitvoering overeenkomst).',
          'Betaalgegevens — verwerkt door Stripe; wij bewaren alleen referenties en bedragen (uitvoering overeenkomst, fiscale bewaarplicht).',
          'Belastinggegevens van makers (wettelijke naam, geboortedatum, adres, BSN/fiscaal nummer) — verplicht onder DAC7 (wettelijke verplichting). Het fiscaal nummer wordt versleuteld opgeslagen en alleen gebruikt voor de jaarlijkse melding.',
          'Beveiligingslogs en meldingen — om fraude en misbruik te voorkomen (gerechtvaardigd belang).'
        ] },
        { h: 'Met wie we het delen', p: ['Onze hosting- en databaseprovider, e-maildienst, opslagdienst voor foto’s en Stripe (betalingen en identiteitscontrole van makers) zijn verwerker of, voor betalingen, zelfstandig verantwoordelijke. De Belastingdienst ontvangt DAC7-gegevens. We verkopen geen persoonsgegevens en gebruiken geen advertentietrackers.'] },
        { h: 'Hoe lang we het bewaren', p: ['Account- en profielgegevens tot je je account verwijdert. Betaal- en opdrachtgegevens 7 jaar (fiscale bewaarplicht). DAC7-gegevens zo lang als de wet vereist. Ongebruikte foto-uploads worden na één dag verwijderd. Verwijderde accounts worden geanonimiseerd; je verzonden berichten worden leeggemaakt.'] },
        { h: 'Je rechten', p: ['Je kunt je gegevens inzien en downloaden (Account → Mijn gegevens downloaden), laten corrigeren, je account verwijderen en bezwaar maken tegen of beperking vragen van verwerking. Je kunt een klacht indienen bij de Autoriteit Persoonsgegevens.'] },
        { h: 'Beveiliging', p: ['Wachtwoorden worden gehasht, verbindingen zijn versleuteld, foto’s worden opnieuw opgeslagen zonder locatiegegevens en toegang tot aanvragen, berichten en foto’s wordt bij elk verzoek gecontroleerd.'] }
      ]
    }
  },
  cookies: {
    en: { title: 'Cookies', sections: [{ h: 'Only what’s needed', p: ['We only use strictly necessary cookies: a session cookie to keep you signed in and a cookie that remembers your language. We do not use analytics or advertising cookies, so we don’t ask for consent.'] }] },
    nl: { title: 'Cookies', sections: [{ h: 'Alleen wat nodig is', p: ['We gebruiken alleen strikt noodzakelijke cookies: een sessiecookie om je ingelogd te houden en een cookie die je taal onthoudt. We gebruiken geen analyse- of advertentiecookies, dus we vragen geen toestemming.'] }] }
  },
  imprint: {
    en: { title: 'Company details', sections: [{ h: '{company}', p: ['Address: {address}', 'Chamber of Commerce (KvK): {kvk}', 'Email: {email}'] }] },
    nl: { title: 'Bedrijfsgegevens', sections: [{ h: '{company}', p: ['Adres: {address}', 'KvK-nummer: {kvk}', 'E-mail: {email}'] }] }
  }
};
