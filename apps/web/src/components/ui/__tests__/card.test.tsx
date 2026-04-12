import { render, screen } from '@/test/test-utils';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Content</Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('sets data-slot=card', () => {
    render(<Card data-testid="card">Test</Card>);
    expect(screen.getByTestId('card')).toHaveAttribute('data-slot', 'card');
  });

  it('defaults to size=default', () => {
    render(<Card data-testid="card">Test</Card>);
    expect(screen.getByTestId('card')).toHaveAttribute('data-size', 'default');
  });

  it('accepts size=sm', () => {
    render(
      <Card data-testid="card" size="sm">
        Small
      </Card>,
    );
    expect(screen.getByTestId('card')).toHaveAttribute('data-size', 'sm');
  });

  it('merges custom className', () => {
    render(
      <Card data-testid="card" className="my-class">
        Test
      </Card>,
    );
    expect(screen.getByTestId('card').className).toContain('my-class');
  });

  it('forwards HTML attributes', () => {
    render(
      <Card data-testid="card" id="card-1" aria-label="Main card">
        Test
      </Card>,
    );
    const el = screen.getByTestId('card');
    expect(el).toHaveAttribute('id', 'card-1');
    expect(el).toHaveAttribute('aria-label', 'Main card');
  });
});

describe('CardHeader', () => {
  it('renders with data-slot=card-header', () => {
    render(<CardHeader data-testid="header">Header</CardHeader>);
    expect(screen.getByTestId('header')).toHaveAttribute('data-slot', 'card-header');
  });

  it('merges custom className', () => {
    render(
      <CardHeader data-testid="header" className="extra">
        H
      </CardHeader>,
    );
    expect(screen.getByTestId('header').className).toContain('extra');
  });
});

describe('CardTitle', () => {
  it('renders with data-slot=card-title', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText('Title')).toHaveAttribute('data-slot', 'card-title');
  });

  it('merges custom className', () => {
    render(<CardTitle className="bold">Title</CardTitle>);
    expect(screen.getByText('Title').className).toContain('bold');
  });
});

describe('CardDescription', () => {
  it('renders with data-slot=card-description', () => {
    render(<CardDescription>Desc</CardDescription>);
    expect(screen.getByText('Desc')).toHaveAttribute('data-slot', 'card-description');
  });

  it('merges custom className', () => {
    render(<CardDescription className="italic">Desc</CardDescription>);
    expect(screen.getByText('Desc').className).toContain('italic');
  });
});

describe('CardAction', () => {
  it('renders with data-slot=card-action', () => {
    render(<CardAction data-testid="action">Act</CardAction>);
    expect(screen.getByTestId('action')).toHaveAttribute('data-slot', 'card-action');
  });
});

describe('CardContent', () => {
  it('renders with data-slot=card-content', () => {
    render(<CardContent data-testid="content">Body</CardContent>);
    expect(screen.getByTestId('content')).toHaveAttribute('data-slot', 'card-content');
  });

  it('merges custom className', () => {
    render(
      <CardContent data-testid="content" className="wide">
        Body
      </CardContent>,
    );
    expect(screen.getByTestId('content').className).toContain('wide');
  });
});

describe('CardFooter', () => {
  it('renders with data-slot=card-footer', () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>);
    expect(screen.getByTestId('footer')).toHaveAttribute('data-slot', 'card-footer');
  });

  it('merges custom className', () => {
    render(
      <CardFooter data-testid="footer" className="sticky">
        Footer
      </CardFooter>,
    );
    expect(screen.getByTestId('footer').className).toContain('sticky');
  });
});

describe('Card composition', () => {
  it('renders a full card with all sub-components', () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>My Title</CardTitle>
          <CardDescription>My Desc</CardDescription>
        </CardHeader>
        <CardContent>Body content</CardContent>
        <CardFooter>Footer content</CardFooter>
      </Card>,
    );

    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('My Desc')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });
});
