import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="card" size="sm">
        ออกจากระบบ
      </Button>
    </form>
  );
}
