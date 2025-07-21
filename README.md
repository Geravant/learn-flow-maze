# Learn Flow Maze

An intelligent, adaptive learning platform that creates personalized educational content using AI-powered content generation. Learn Flow Maze provides an interactive card-based learning experience with progressive content loading and comprehensive quiz systems.

## Features

- **AI-Powered Content Generation**: Leverages the Infinite-Wiki engine for enhanced learning card creation
- **Progressive Loading**: Content loads section by section for optimal performance on all devices
- **Interactive Learning Cards**: Swipe-based navigation with intuitive gestures
- **Adaptive Quizzes**: Both traditional and progressive quiz generation with multiple question types
- **Mobile-First Design**: Optimized for both desktop and mobile learning experiences
- **Personalized Topics**: Choose your own learning topics or get AI-generated suggestions
- **Session Tracking**: Comprehensive progress tracking and mastery level monitoring

## Technology Stack

This project is built with modern web technologies:

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: shadcn/ui components with Tailwind CSS
- **Animations**: Framer Motion for smooth interactions
- **AI Integration**: OpenRouter API for LLM services
- **Content Engine**: Infinite-Wiki engine for enhanced content generation

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd learn-flow-maze
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Configure your OpenRouter API key in `.env`:
```env
VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:8080` (or the next available port).

## Configuration

### AI Services

The app uses OpenRouter API to access various language models. To get an API key:

1. Visit [OpenRouter](https://openrouter.ai)
2. Sign up for an account
3. Generate an API key
4. Add it to your `.env` file

The application will gracefully degrade if no API key is provided, using fallback content generation.

### Progressive Loading

Progressive loading can be toggled in the UI and is automatically disabled on mobile devices for optimal performance. You can customize this behavior in the `LearnSession.tsx` component.

## Usage

### Basic Learning Flow

1. **Start Session**: Enter an OpenRouter API key (or use environment configuration)
2. **Choose Topic**: Select a topic or use AI-generated suggestions
3. **Learn**: Interact with cards using:
   - **Swipe Right**: "Got it!" - move to next concept
   - **Swipe Left**: "Review" - mark for later review
   - **Swipe Up**: "Help" - get AI tutor assistance
   - **Swipe Down**: "Explore" - discover related topics
   - **Tap**: Take a quick quiz

### Progressive vs Traditional Loading

- **Progressive Loading**: Content loads section by section as it's generated
- **Traditional Loading**: Complete cards are generated before display
- Mobile devices default to traditional loading for better performance

## Development

### Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # Reusable UI components (shadcn/ui)
│   ├── LearningCard.tsx # Main learning card component
│   ├── LearnSession.tsx # Main session management
│   └── QuizModal.tsx   # Quiz interface
├── services/           # API and business logic
│   ├── apiKeyManager.ts      # Centralized API key management
│   ├── openRouterService.ts  # OpenRouter API integration
│   ├── progressiveCardService.ts  # Progressive loading logic
│   └── infiniteWikiService.ts    # Infinite-wiki engine integration
└── hooks/              # Custom React hooks
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with React and the modern web development ecosystem
- UI components powered by shadcn/ui
- AI capabilities provided by OpenRouter API
- Enhanced content generation via Infinite-Wiki engine