export type SentimentLabel = "positive" | "neutral" | "negative";
export type BiasLabel = "left" | "center" | "right" | "mixed" | "unclear";

export interface MockArticle {
  id: string;
  title: string;
  sourceName: string;
  country: string;
  category: string;
  publishedAgo: string;
  author: string;
  readTimeMinutes: number;
  imageUrl?: string;
  sentimentLabel: SentimentLabel;
  biasLabel: BiasLabel;
  leftPercentage: number;
  centerPercentage: number;
  rightPercentage: number;
  confidence?: number;
  summary: string;
  framingNotes: string;
  loadedTerms: string[];
  disclaimer: string;
  bodyParagraphs: string[];
}

const STANDARD_DISCLAIMER =
  "This analysis is AI-generated from the article text and may contain inaccuracies. It is not a substitute for reading the full source article.";

export const mockArticles: MockArticle[] = [
  {
    id: "1",
    title: "Trump Sends Iran Revised Peace Proposal With Tougher Terms: Report",
    sourceName: "Reuters",
    country: "United States",
    category: "Politics",
    publishedAgo: "2h ago",
    author: "David Morgan",
    readTimeMinutes: 6,
    sentimentLabel: "neutral",
    biasLabel: "right",
    leftPercentage: 20,
    centerPercentage: 31,
    rightPercentage: 49,
    confidence: 0.82,
    summary:
      "The Trump administration has sent Iran a revised nuclear deal proposal with tougher terms, including a halt to uranium enrichment and unrestricted inspector access. Iran has not officially responded but says any deal must respect its right to peaceful nuclear energy and include sanctions relief.",
    framingNotes:
      "Coverage leans on administration officials' framing of the proposal as a firm, non-negotiable stance, with less space given to Iranian or European perspectives on the terms.",
    loadedTerms: ["take-it-or-leave-it", "weak agreement", "unrestricted access"],
    disclaimer: STANDARD_DISCLAIMER,
    bodyParagraphs: [
      "The Trump administration has sent Iran a revised nuclear deal proposal that includes tougher terms on uranium enrichment and stronger verification measures, according to a report published Saturday.",
      "The new proposal, delivered through intermediaries in Oman, requires Iran to halt all uranium enrichment on its soil and ship its stockpile of enriched uranium out of the country. It also demands unrestricted access for international inspectors to all Iranian nuclear facilities, including military sites.",
      "\"This is a take-it-or-leave-it proposal,\" a senior administration official said. \"The President wants a deal, but he will not accept a weak agreement that puts America or our allies at risk.\"",
      "Iran has not yet officially responded to the proposal. However, Iranian officials have said that any deal must respect Iran's right to peaceful nuclear energy and include the lifting of U.S. sanctions.",
      "European allies have urged both sides to continue negotiations, saying diplomacy remains the best path forward. The fate of the proposal now rests with Iran, as global attention remains focused on whether a new nuclear agreement can be reached.",
    ],
  },
  {
    id: "2",
    title: "Researchers Make Case for Grapes as a 'Superfood' After Review of Health Evidence",
    sourceName: "NPR",
    country: "United States",
    category: "Health",
    publishedAgo: "4h ago",
    author: "Allison Chen",
    readTimeMinutes: 5,
    sentimentLabel: "positive",
    biasLabel: "center",
    leftPercentage: 18,
    centerPercentage: 42,
    rightPercentage: 40,
    confidence: 0.71,
    summary:
      "A review of existing health studies makes the case that grapes deserve a spot among recognized \"superfoods\" thanks to their antioxidant and cardiovascular benefits. Researchers caution that no single food is a substitute for an overall balanced diet.",
    framingNotes:
      "The piece is largely descriptive and evidence-based, citing peer-reviewed studies rather than advocacy from any political or commercial interest group.",
    loadedTerms: ["superfood", "miracle fruit"],
    disclaimer: STANDARD_DISCLAIMER,
    bodyParagraphs: [
      "A new review of decades of nutrition research is making the case that grapes belong alongside blueberries and kale on the list of foods commonly labeled \"superfoods.\"",
      "The review, compiled by a team of nutrition scientists, points to grapes' concentration of polyphenols and resveratrol, compounds linked in multiple studies to improved cardiovascular markers and reduced inflammation.",
      "\"No single food is a magic bullet,\" one of the review's authors cautioned, \"but grapes pack a surprising amount of benefit for relatively few calories.\"",
      "The researchers stopped short of recommending grapes over other fruits, noting that variety in a diet matters more than any one item, but said the fruit's health profile has been consistently underrated.",
    ],
  },
  {
    id: "3",
    title: "CERN Finds High-Significance Hint of Physics Beyond Standard Model",
    sourceName: "BBC",
    country: "Switzerland",
    category: "Science",
    publishedAgo: "5h ago",
    author: "Helen Briggs",
    readTimeMinutes: 7,
    sentimentLabel: "positive",
    biasLabel: "center",
    leftPercentage: 16,
    centerPercentage: 62,
    rightPercentage: 22,
    confidence: 0.88,
    summary:
      "Physicists at CERN report a high-significance anomaly in particle collision data that could point to physics beyond the Standard Model. Independent teams are now racing to confirm the result before it is treated as a discovery.",
    framingNotes:
      "Reporting is measured and sourced directly from CERN physicists, with appropriate caveats about the need for independent replication before the result is confirmed.",
    loadedTerms: ["landmark", "beyond the Standard Model"],
    disclaimer: STANDARD_DISCLAIMER,
    bodyParagraphs: [
      "Physicists at CERN's Large Hadron Collider have detected a high-significance anomaly in particle collision data that, if confirmed, could point to physics beyond the Standard Model.",
      "The result emerged from an analysis of billions of proton-proton collisions, where researchers found a small but statistically significant deviation from predictions in how certain particles decay.",
      "\"We've seen hints like this before that didn't hold up,\" one CERN physicist said, \"but the significance here is high enough that we have to take it seriously and try to break it.\"",
      "Independent research groups are now attempting to replicate the finding using separate datasets. Physicists say a confirmed result would be one of the most significant discoveries in particle physics in over a decade.",
    ],
  },
  {
    id: "4",
    title: "Indigenous Leader Brooklyn Rivera Dies in Nicaragua After Nearly 3 Years of Detention",
    sourceName: "Guardian",
    country: "Nicaragua",
    category: "World",
    publishedAgo: "6h ago",
    author: "Sofia Menendez",
    readTimeMinutes: 6,
    sentimentLabel: "negative",
    biasLabel: "left",
    leftPercentage: 54,
    centerPercentage: 28,
    rightPercentage: 18,
    confidence: 0.76,
    summary:
      "Indigenous rights leader Brooklyn Rivera has died in Nicaragua after nearly three years in government detention. Human rights groups say his treatment reflects a broader crackdown on Indigenous and opposition figures under the current government.",
    framingNotes:
      "The article emphasizes accounts from human rights organizations and Rivera's family, framing the death within a narrative of government repression rather than presenting the government's position in comparable depth.",
    loadedTerms: ["crackdown", "political prisoner", "repression"],
    disclaimer: STANDARD_DISCLAIMER,
    bodyParagraphs: [
      "Brooklyn Rivera, a longtime leader of Nicaragua's Indigenous Miskito community, has died after nearly three years in government detention, his family and human rights groups confirmed Tuesday.",
      "Rivera was detained in 2023 amid a broader government crackdown on opposition figures, journalists, and Indigenous rights advocates. Rights groups say his health had been deteriorating for months, with limited access to medical care.",
      "\"Brooklyn spent his life defending Indigenous land rights,\" a fellow activist said. \"His death in custody is a direct consequence of the repression his community has faced for years.\"",
      "The Nicaraguan government has not issued a public statement on Rivera's death. International rights organizations are calling for an independent investigation into the conditions of his detention.",
    ],
  },
  {
    id: "5",
    title: "UN Security Council to Hold Emergency Meeting as Israel Pushes Deeper into Lebanon",
    sourceName: "Al Jazeera",
    country: "Middle East",
    category: "World",
    publishedAgo: "7h ago",
    author: "Marwan Kassab",
    readTimeMinutes: 8,
    sentimentLabel: "negative",
    biasLabel: "mixed",
    leftPercentage: 22,
    centerPercentage: 35,
    rightPercentage: 43,
    confidence: 0.64,
    summary:
      "The UN Security Council will hold an emergency session after Israeli forces advanced further into southern Lebanon. Regional and international officials are calling for de-escalation as civilian casualty reports mount.",
    framingNotes:
      "The article presents statements from multiple sides — Israeli, Lebanese, and UN officials — though word choice around the advance carries some negative framing.",
    loadedTerms: ["pushes deeper", "emergency meeting"],
    disclaimer: STANDARD_DISCLAIMER,
    bodyParagraphs: [
      "The United Nations Security Council will convene an emergency session this week after Israeli forces advanced further into southern Lebanon, according to diplomats familiar with the schedule.",
      "The move follows several days of intensified fighting along the border region, with both Israeli and Lebanese officials reporting casualties among combatants and civilians.",
      "A UN spokesperson said the council would hear briefings from regional envoys and humanitarian agencies, with several member states expected to call for an immediate ceasefire.",
      "Israeli officials have defended the operation as necessary to secure the border, while Lebanese officials have called it a violation of sovereignty. International mediators say the situation remains fluid.",
    ],
  },
  {
    id: "6",
    title: "Oil Prices Dip as OPEC+ Considers Output Increase Amid Weak Demand",
    sourceName: "Bloomberg",
    country: "Global",
    category: "Business",
    publishedAgo: "8h ago",
    author: "Grant Feldman",
    readTimeMinutes: 4,
    sentimentLabel: "neutral",
    biasLabel: "center",
    leftPercentage: 25,
    centerPercentage: 50,
    rightPercentage: 25,
    confidence: 0.79,
    summary:
      "Oil prices slipped after reports that OPEC+ members are weighing a production increase amid signs of softening global demand. Analysts say the group is balancing member-state revenue needs against oversupply risks.",
    framingNotes:
      "Straightforward market reporting sourced from analysts and OPEC+ delegates, with no discernible partisan framing.",
    loadedTerms: [],
    disclaimer: STANDARD_DISCLAIMER,
    bodyParagraphs: [
      "Oil prices dipped in early trading Thursday after reports that OPEC+ members are considering a further increase in production output, adding to concerns about oversupply amid weakening global demand.",
      "Delegates from several member states said discussions are ongoing ahead of the group's next scheduled meeting, with no final decision yet reached on the size or timing of any increase.",
      "\"Demand growth has been softer than expected, particularly out of Asia,\" one commodities analyst said. \"An output increase now would put more downward pressure on prices.\"",
      "Markets are watching for the group's next formal statement, with traders pricing in the possibility of a modest increase in the coming quarter.",
    ],
  },
  {
    id: "7",
    title: "SpaceX Launches Starship Test Flight in Milestone for Mars Program",
    sourceName: "AP News",
    country: "United States",
    category: "Technology",
    publishedAgo: "9h ago",
    author: "Marcia Dunn",
    readTimeMinutes: 5,
    sentimentLabel: "positive",
    biasLabel: "right",
    leftPercentage: 12,
    centerPercentage: 45,
    rightPercentage: 43,
    confidence: 0.7,
    summary:
      "SpaceX successfully completed a Starship test flight, a milestone the company says brings its long-term Mars program closer to reality. Engineers highlighted improvements in heat-shield performance and booster recovery.",
    framingNotes:
      "The article largely reflects SpaceX's own framing of the launch as a success, with limited independent scrutiny of remaining technical risks.",
    loadedTerms: ["milestone", "historic"],
    disclaimer: STANDARD_DISCLAIMER,
    bodyParagraphs: [
      "SpaceX successfully launched a Starship test flight Wednesday, a milestone the company says brings its long-term goal of crewed Mars missions closer to reality.",
      "The flight tested upgrades to the vehicle's heat shield and demonstrated an improved booster recovery sequence, both of which engineers had flagged as priorities after earlier test flights.",
      "\"Every flight gets us closer to full and rapid reusability,\" a SpaceX engineer said during the livestreamed launch commentary.",
      "The company says it plans several more test flights before attempting more ambitious mission profiles, including orbital refueling demonstrations needed for deep-space missions.",
    ],
  },
  {
    id: "8",
    title: "Apple Unveils AI-Powered Features Across iPhone, iPad and Mac",
    sourceName: "The Verge",
    country: "United States",
    category: "Business",
    publishedAgo: "10h ago",
    author: "Jake Kastrenakes",
    readTimeMinutes: 6,
    sentimentLabel: "positive",
    biasLabel: "center",
    leftPercentage: 15,
    centerPercentage: 40,
    rightPercentage: 45,
    confidence: 0.68,
    summary:
      "Apple announced a new suite of AI-powered features rolling out across iPhone, iPad, and Mac, including on-device writing tools and smarter search. The company emphasized privacy-preserving on-device processing over cloud-based alternatives.",
    framingNotes:
      "Coverage draws heavily on Apple's own presentation and messaging, with limited independent comparison to competitors' offerings.",
    loadedTerms: ["game-changing", "revolutionary"],
    disclaimer: STANDARD_DISCLAIMER,
    bodyParagraphs: [
      "Apple unveiled a new suite of AI-powered features Tuesday that will roll out across iPhone, iPad, and Mac later this year, including on-device writing tools, smarter photo search, and an upgraded voice assistant.",
      "Company executives emphasized that most of the new features process data on-device rather than in the cloud, framing the approach as a privacy advantage over rival offerings.",
      "\"We think AI should work for you without asking you to give up your privacy,\" one Apple executive said during the announcement.",
      "Analysts say the update puts Apple's AI features roughly on par with competitors, though some noted the on-device approach may limit the complexity of tasks the assistant can handle compared to cloud-based rivals.",
    ],
  },
  {
    id: "9",
    title: "2025 on Track to Be Among Top 3 Hottest Years, EU Climate Service Says",
    sourceName: "Reuters",
    country: "Global",
    category: "Climate",
    publishedAgo: "11h ago",
    author: "Kate Abnett",
    readTimeMinutes: 5,
    sentimentLabel: "negative",
    biasLabel: "unclear",
    leftPercentage: 33,
    centerPercentage: 34,
    rightPercentage: 33,
    confidence: 0.52,
    summary:
      "The EU's climate monitoring service says 2025 is on track to rank among the three hottest years on record globally. Scientists point to a combination of long-term warming trends and shorter-term ocean temperature patterns.",
    framingNotes:
      "The article sticks closely to the climate service's data and scientific commentary; evidence for a left or right lean is weak, so the framing reads as largely descriptive.",
    loadedTerms: [],
    disclaimer: STANDARD_DISCLAIMER,
    bodyParagraphs: [
      "The European Union's climate monitoring service said Wednesday that 2025 is on track to rank among the three hottest years globally since records began, extending a multi-year streak of record or near-record temperatures.",
      "Scientists at the service pointed to a combination of long-term greenhouse gas warming trends and shorter-term ocean temperature patterns as contributing factors to the year's heat.",
      "\"We continue to see the fingerprint of long-term warming overlaid on natural variability,\" one climate scientist involved in the report said.",
      "The findings add to a growing body of annual data showing accelerating global temperature trends, with the service noting that final-year rankings will be confirmed once December data is complete.",
    ],
  },
];

export function getMockArticleById(id: string): MockArticle | undefined {
  return mockArticles.find((article) => article.id === id);
}

export function getRelatedMockArticles(id: string, limit = 5): MockArticle[] {
  const current = getMockArticleById(id);
  const others = mockArticles.filter((article) => article.id !== id);

  if (!current) {
    return others.slice(0, limit);
  }

  const sameCategory = others.filter((article) => article.category === current.category);
  const rest = others.filter((article) => article.category !== current.category);

  return [...sameCategory, ...rest].slice(0, limit);
}
