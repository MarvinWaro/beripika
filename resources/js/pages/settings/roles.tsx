import { Head, router, useForm } from '@inertiajs/react';
import {
    Check,
    Copy,
    Lock,
    Minus,
    Plus,
    Save,
    ShieldCheck,
    Trash2,
    Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import InputError from '@/components/input-error';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type PermissionItem = {
    id: number;
    name: string;
    display_name: string;
    description: string | null;
};

type PermissionGroup = {
    group: string;
    label: string;
    permissions: PermissionItem[];
};

type Role = {
    id: number;
    name: string;
    display_name: string;
    description: string | null;
    is_system: boolean;
    users_count: number;
    permissions: number[];
    permission_names: string[];
};

type Props = {
    roles: Role[];
    permissionGroups: PermissionGroup[];
};

type RoleForm = {
    name: string;
    display_name: string;
    description: string;
    permissions: number[];
};

const emptyForm: RoleForm = {
    name: '',
    display_name: '',
    description: '',
    permissions: [],
};

export default function RolesIndex({ roles, permissionGroups }: Props) {
    const [selectedId, setSelectedId] = useState<number | 'new'>(
        roles.find((r) => !r.is_system)?.id ?? roles[0]?.id ?? 'new',
    );
    const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);

    const selected =
        selectedId === 'new' ? null : roles.find((r) => r.id === selectedId) ?? null;
    const locked = selected?.is_system ?? false;
    const totalPermissions = permissionGroups.reduce(
        (sum, g) => sum + g.permissions.length,
        0,
    );

    const form = useForm<RoleForm>(toForm(selected));

    const selectRole = (id: number | 'new') => {
        setSelectedId(id);
        const role = id === 'new' ? null : roles.find((r) => r.id === id) ?? null;
        form.setData(toForm(role));
        form.clearErrors();
    };

    const toggle = (id: number, on: boolean) =>
        form.setData(
            'permissions',
            on
                ? [...new Set([...form.data.permissions, id])]
                : form.data.permissions.filter((p) => p !== id),
        );

    const toggleGroup = (group: PermissionGroup, on: boolean) => {
        const ids = group.permissions.map((p) => p.id);
        form.setData(
            'permissions',
            on
                ? [...new Set([...form.data.permissions, ...ids])]
                : form.data.permissions.filter((p) => !ids.includes(p)),
        );
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selected) {
            form.put(`/roles/${selected.id}`, { preserveScroll: true });
        } else {
            form.post('/roles', {
                preserveScroll: true,
                onSuccess: (page) => {
                    const created = (page.props.roles as Role[]).find(
                        (r) => r.display_name === form.data.display_name,
                    );
                    if (created) selectRole(created.id);
                },
            });
        }
    };

    const dirty = useMemo(() => {
        const base = toForm(selected);
        return (
            base.display_name !== form.data.display_name ||
            base.description !== form.data.description ||
            base.permissions.length !== form.data.permissions.length ||
            base.permissions.some((p) => !form.data.permissions.includes(p))
        );
    }, [selected, form.data]);

    return (
        <>
            <Head title="Roles & Permissions" />

            <div className="flex flex-1 flex-col gap-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">
                            Roles &amp; Permissions
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Decide what each role can see and do. Changes apply on the
                            user&apos;s next page load.
                        </p>
                    </div>
                    <Button onClick={() => selectRole('new')}>
                        <Plus className="size-4" />
                        New role
                    </Button>
                </div>

                <Tabs defaultValue="edit" className="gap-4">
                    <TabsList>
                        <TabsTrigger value="edit">Edit roles</TabsTrigger>
                        <TabsTrigger value="matrix">Permission matrix</TabsTrigger>
                    </TabsList>

                    <TabsContent value="edit">
                        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                            {/* Role list */}
                            <div className="flex flex-col gap-2">
                                {roles.map((role) => (
                                    <button
                                        key={role.id}
                                        type="button"
                                        onClick={() => selectRole(role.id)}
                                        className={cn(
                                            'rounded-lg border p-3 text-left transition-colors hover:bg-muted/60',
                                            selectedId === role.id &&
                                                'border-primary bg-primary/5 ring-1 ring-primary',
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium">
                                                {role.display_name}
                                            </span>
                                            {role.is_system && (
                                                <Lock className="size-3.5 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Users className="size-3" />
                                                {role.users_count}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <ShieldCheck className="size-3" />
                                                {role.permissions.length}/{totalPermissions}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                                {selectedId === 'new' && (
                                    <div className="rounded-lg border border-dashed border-primary bg-primary/5 p-3 text-sm font-medium">
                                        New role
                                    </div>
                                )}
                            </div>

                            {/* Editor */}
                            <form onSubmit={submit}>
                                <Card>
                                    <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="space-y-1">
                                            <CardTitle className="flex items-center gap-2">
                                                {selected ? selected.display_name : 'New role'}
                                                {locked && (
                                                    <Badge variant="secondary">
                                                        <Lock className="size-3" />
                                                        System
                                                    </Badge>
                                                )}
                                            </CardTitle>
                                            <CardDescription>
                                                {locked
                                                    ? 'This role always has every permission and cannot be edited.'
                                                    : `${form.data.permissions.length} of ${totalPermissions} permissions selected`}
                                            </CardDescription>
                                        </div>
                                        {selected && (
                                            <div className="flex gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        router.post(
                                                            `/roles/${selected.id}/duplicate`,
                                                            {},
                                                            { preserveScroll: true },
                                                        )
                                                    }
                                                >
                                                    <Copy className="size-4" />
                                                    Duplicate
                                                </Button>
                                                {!locked && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-destructive"
                                                        disabled={selected.users_count > 0}
                                                        title={
                                                            selected.users_count > 0
                                                                ? 'Move its users to another role first'
                                                                : undefined
                                                        }
                                                        onClick={() => setConfirmDelete(selected)}
                                                    >
                                                        <Trash2 className="size-4" />
                                                        Delete
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </CardHeader>

                                    <CardContent className="space-y-6">
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label htmlFor="display_name">Role name</Label>
                                                <Input
                                                    id="display_name"
                                                    value={form.data.display_name}
                                                    disabled={locked}
                                                    placeholder="e.g. PRC Verifier"
                                                    onChange={(e) =>
                                                        form.setData('display_name', e.target.value)
                                                    }
                                                    required
                                                />
                                                <InputError
                                                    message={form.errors.display_name || form.errors.name}
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="description">Description</Label>
                                                <Textarea
                                                    id="description"
                                                    rows={1}
                                                    value={form.data.description}
                                                    disabled={locked}
                                                    placeholder="Who gets this role?"
                                                    onChange={(e) =>
                                                        form.setData('description', e.target.value)
                                                    }
                                                />
                                                <InputError message={form.errors.description} />
                                            </div>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2">
                                            {permissionGroups.map((group) => {
                                                const ids = group.permissions.map((p) => p.id);
                                                const count = ids.filter((id) =>
                                                    form.data.permissions.includes(id),
                                                ).length;
                                                const state =
                                                    count === 0
                                                        ? false
                                                        : count === ids.length
                                                          ? true
                                                          : 'indeterminate';

                                                return (
                                                    <div
                                                        key={group.group}
                                                        className="rounded-lg border"
                                                    >
                                                        <label className="flex cursor-pointer items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
                                                            <span className="text-sm font-semibold">
                                                                {group.label}
                                                            </span>
                                                            <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                {count}/{ids.length}
                                                                <Checkbox
                                                                    checked={state}
                                                                    disabled={locked}
                                                                    onCheckedChange={(v) =>
                                                                        toggleGroup(group, v === true)
                                                                    }
                                                                    aria-label={`Select all ${group.label}`}
                                                                />
                                                            </span>
                                                        </label>
                                                        <div className="divide-y">
                                                            {group.permissions.map((permission) => (
                                                                <label
                                                                    key={permission.id}
                                                                    className="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-muted/30"
                                                                >
                                                                    <Checkbox
                                                                        className="mt-0.5"
                                                                        checked={form.data.permissions.includes(permission.id)}
                                                                        disabled={locked}
                                                                        onCheckedChange={(v) =>
                                                                            toggle(permission.id, v === true)
                                                                        }
                                                                    />
                                                                    <span className="grid gap-0.5">
                                                                        <span className="text-sm font-medium">
                                                                            {permission.display_name}
                                                                        </span>
                                                                        {permission.description && (
                                                                            <span className="text-xs text-muted-foreground">
                                                                                {permission.description}
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <InputError message={form.errors.permissions} />

                                        {!locked && (
                                            <div className="flex items-center justify-end gap-2 border-t pt-4">
                                                {dirty && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() => selectRole(selectedId)}
                                                    >
                                                        Discard changes
                                                    </Button>
                                                )}
                                                <Button
                                                    type="submit"
                                                    disabled={form.processing || (!dirty && !!selected)}
                                                >
                                                    <Save className="size-4" />
                                                    {selected ? 'Save changes' : 'Create role'}
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </form>
                        </div>
                    </TabsContent>

                    <TabsContent value="matrix">
                        <Card className="overflow-hidden py-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="sticky left-0 bg-muted/50 px-4 py-3 text-left font-medium">
                                                Permission
                                            </th>
                                            {roles.map((role) => (
                                                <th
                                                    key={role.id}
                                                    className="px-3 py-3 text-center font-medium whitespace-nowrap"
                                                >
                                                    {role.display_name}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {permissionGroups.map((group) => (
                                            <PermissionRows
                                                key={group.group}
                                                group={group}
                                                roles={roles}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            <AlertDialog
                open={!!confirmDelete}
                onOpenChange={(open) => !open && setConfirmDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete {confirmDelete?.display_name}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This removes the role and its permission settings. This cannot
                            be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => {
                                if (!confirmDelete) return;
                                router.delete(`/roles/${confirmDelete.id}`, {
                                    preserveScroll: true,
                                    onSuccess: () => selectRole(roles.find((r) => r.id !== confirmDelete.id)?.id ?? 'new'),
                                });
                                setConfirmDelete(null);
                            }}
                        >
                            Delete role
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function PermissionRows({ group, roles }: { group: PermissionGroup; roles: Role[] }) {
    return (
        <>
            <tr className="border-t bg-muted/20">
                <td
                    colSpan={roles.length + 1}
                    className="sticky left-0 px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                    {group.label}
                </td>
            </tr>
            {group.permissions.map((permission) => (
                <tr key={permission.id} className="border-t">
                    <td className="sticky left-0 bg-background px-4 py-2">
                        {permission.display_name}
                    </td>
                    {roles.map((role) => (
                        <td key={role.id} className="px-3 py-2 text-center">
                            {role.permission_names.includes(permission.name) ? (
                                <Check className="mx-auto size-4 text-emerald-600" aria-label="Allowed" />
                            ) : (
                                <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label="Not allowed" />
                            )}
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}

function toForm(role: Role | null): RoleForm {
    if (!role) return { ...emptyForm };

    return {
        name: role.name,
        display_name: role.display_name,
        description: role.description ?? '',
        permissions: [...role.permissions],
    };
}

RolesIndex.layout = {
    breadcrumbs: [{ title: 'Roles & Permissions', href: '/roles' }],
};
