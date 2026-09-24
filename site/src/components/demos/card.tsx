import { Button } from "@mitame/ui/button";
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from "@mitame/ui/card";

export default function CardDemo() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Weekly digest</CardTitle>
        <CardDescription>A summary of what changed in your projects.</CardDescription>
      </CardHeader>
      <CardBody className="text-sm">12 new comments, 3 merged pull requests.</CardBody>
      <CardFooter>
        <Button>Later</Button>
        <Button variant="primary">Open</Button>
      </CardFooter>
    </Card>
  );
}
