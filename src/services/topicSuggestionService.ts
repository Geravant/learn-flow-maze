import { getRandomWord } from './infiniteWikiService';

export class TopicSuggestionService {
  private static readonly DEFAULT_TOPICS = [
    "Quantum Physics",
    "Machine Learning",
    "Blockchain Technology",
    "Climate Change",
    "Artificial Intelligence",
    "Space Exploration",
    "Renewable Energy",
    "Cryptocurrency",
    "Neuroscience",
    "Biotechnology",
    "Virtual Reality",
    "Philosophy",
    "Ancient History",
    "Psychology",
    "Mathematics",
    "Astronomy",
    "Literature",
    "Art History",
    "Economics",
    "Genetics"
  ];

  static async getRandomTopics(count: number = 3): Promise<string[]> {
    const suggestions: string[] = [];
    
    try {
      // Try to get AI-generated suggestions first
      for (let i = 0; i < Math.min(count, 2); i++) {
        try {
          const aiTopic = await getRandomWord();
          if (aiTopic && aiTopic.length > 2) {
            suggestions.push(this.capitalizeTopic(aiTopic));
          }
        } catch (error) {
          console.warn('Failed to get AI topic suggestion:', error);
          break;
        }
      }
    } catch (error) {
      console.warn('AI topic generation not available:', error);
    }

    // Fill remaining slots with default topics
    const remainingCount = count - suggestions.length;
    const shuffledDefaults = [...this.DEFAULT_TOPICS]
      .sort(() => Math.random() - 0.5)
      .slice(0, remainingCount);
    
    suggestions.push(...shuffledDefaults);
    
    return suggestions.slice(0, count);
  }

  static getPopularTopics(): string[] {
    return [
      "Machine Learning",
      "Climate Change", 
      "Quantum Physics",
      "Cryptocurrency",
      "Space Exploration",
      "Artificial Intelligence"
    ];
  }

  static getCategoryTopics(category: string): string[] {
    const categories: Record<string, string[]> = {
      science: [
        "Quantum Physics", "Neuroscience", "Genetics", "Astronomy", 
        "Chemistry", "Biology", "Environmental Science"
      ],
      technology: [
        "Machine Learning", "Blockchain", "Virtual Reality", "Robotics",
        "Cybersecurity", "Cloud Computing", "Internet of Things"
      ],
      humanities: [
        "Philosophy", "Literature", "Art History", "Ancient History",
        "Linguistics", "Cultural Anthropology", "Ethics"
      ],
      social: [
        "Psychology", "Economics", "Sociology", "Political Science",
        "International Relations", "Urban Planning", "Education"
      ]
    };

    return categories[category] || this.DEFAULT_TOPICS.slice(0, 6);
  }

  private static capitalizeTopic(topic: string): string {
    return topic
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  static validateTopic(topic: string): boolean {
    return topic.trim().length >= 2 && topic.trim().length <= 50;
  }
}

export const topicSuggestionService = TopicSuggestionService;