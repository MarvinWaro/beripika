import { Head, useForm, router, usePage } from '@inertiajs/react';
import type { SharedData } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Plus, Edit, Trash2, Mail, CheckCircle, XCircle, Info } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePermissions } from '@/hooks/use-permissions';

interface Role {
    id: number;
    name: string;
    display_name: string;
}

interface User {
    id: number;
    name: string;
    email: string;
    role: Role | null;
    role_id: number | null;
    is_active: boolean;
    two_factor_enabled: boolean;
    last_login_at: string | null;
    created_at: string;
}

interface Props {
    users: {
        data: User[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    roles: Role[];
    filters: {
        search: string | null;
        role: number | null;
        status: 'active' | 'inactive' | null;
        sort_by: string;
        sort_order: string;
    };
}

export default function UsersIndex({ users, roles, filters }: Props) {
    const { can, isSuperAdmin } = usePermissions();
    const { auth } = usePage<SharedData>().props;
    const [search, setSearch] = useState(filters.search || '');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deletePopoverId, setDeletePopoverId] = useState<number | null>(null);
    const [toggleActivePopoverId, setToggleActivePopoverId] = useState<number | null>(null);

    // Create user form (no password fields)
    const createForm = useForm({
        name: '',
        email: '',
        role_id: roles.length > 0 ? roles[0].id : 0,
    });

    // Edit user form
    const editForm = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role_id: 0,
    });

    // Handle search
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/users', { ...filters, search: search || undefined }, { preserveState: true });
    };

    // Handle create user
    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post('/users', {
            onSuccess: () => {
                setIsCreateOpen(false);
                createForm.reset();
            },
        });
    };

    // Handle edit user
    const handleEdit = (user: User) => {
        setEditingUser(user);
        // Find the role_id from the user's role name if role_id is not set
        const roleId = user.role_id || roles[0]?.id || 0;
        editForm.setData({
            name: user.name,
            email: user.email,
            password: '',
            password_confirmation: '',
            role_id: roleId,
        });
        setIsEditOpen(true);
    };

    // Handle update user
    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        editForm.put(`/users/${editingUser.id}`, {
            onSuccess: () => {
                setIsEditOpen(false);
                setEditingUser(null);
                editForm.reset();
            },
        });
    };

    // Handle delete user
    const handleDelete = (userId: number) => {
        router.delete(`/users/${userId}`, {
            onSuccess: () => {
                setDeletePopoverId(null);
            },
        });
    };

    // Handle toggle active status
    const handleToggleActive = (userId: number) => {
        router.patch(`/users/${userId}/toggle-active`, {}, {
            onSuccess: () => {
                setToggleActivePopoverId(null);
            },
        });
    };

    // Get initials for avatar
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // Format date
    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <>
            <Head title="Users" />

            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">User Management</h1>
                    <p className="text-sm text-muted-foreground">
                        Create accounts, assign roles and control who can sign in
                    </p>
                </div>

                {can('create_users') && (
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add User
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <form onSubmit={handleCreate}>
                                    <DialogHeader>
                                        <DialogTitle>Create New User</DialogTitle>
                                        <DialogDescription>
                                            Add a new user to the system
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <Alert>
                                            <Info className="h-4 w-4" />
                                            <AlertDescription>
                                                A strong temporary password is generated and shown once after saving. Ask the user to change it under Settings → Security.
                                            </AlertDescription>
                                        </Alert>

                                        <div className="space-y-2">
                                            <Label htmlFor="create-name">Name</Label>
                                            <Input
                                                id="create-name"
                                                value={createForm.data.name}
                                                onChange={(e) =>
                                                    createForm.setData('name', e.target.value)
                                                }
                                                placeholder="John Doe"
                                                required
                                            />
                                            {createForm.errors.name && (
                                                <p className="text-sm text-destructive">
                                                    {createForm.errors.name}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="create-email">Email</Label>
                                            <Input
                                                id="create-email"
                                                type="email"
                                                value={createForm.data.email}
                                                onChange={(e) =>
                                                    createForm.setData('email', e.target.value)
                                                }
                                                placeholder="john@example.com"
                                                required
                                            />
                                            {createForm.errors.email && (
                                                <p className="text-sm text-destructive">
                                                    {createForm.errors.email}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="create-role">Role</Label>
                                            <Select
                                                value={createForm.data.role_id.toString()}
                                                onValueChange={(value) =>
                                                    createForm.setData('role_id', parseInt(value))
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {roles.map((role) => (
                                                        <SelectItem key={role.id} value={role.id.toString()}>
                                                            {role.display_name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {createForm.errors.role_id && (
                                                <p className="text-sm text-destructive">
                                                    {createForm.errors.role_id}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setIsCreateOpen(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button type="submit" disabled={createForm.processing}>
                                            {createForm.processing ? 'Creating...' : 'Create User'}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                )}
                    </div>

                    {/* Search and Filters */}
                    <div className="flex items-center space-x-2">
                        <form onSubmit={handleSearch} className="flex flex-1 items-center space-x-2">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search users..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <Select
                                value={filters.role ? String(filters.role) : 'all'}
                                onValueChange={(value) =>
                                    router.get('/users', { ...filters, search: search || undefined, role: value === 'all' ? undefined : value, page: undefined }, { preserveState: true })
                                }
                            >
                                <SelectTrigger className="w-44">
                                    <SelectValue placeholder="All roles" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All roles</SelectItem>
                                    {roles.map((role) => (
                                        <SelectItem key={role.id} value={String(role.id)}>
                                            {role.display_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={filters.status ?? 'all'}
                                onValueChange={(value) =>
                                    router.get('/users', { ...filters, search: search || undefined, status: value === 'all' ? undefined : value, page: undefined }, { preserveState: true })
                                }
                            >
                                <SelectTrigger className="w-36">
                                    <SelectValue placeholder="Any status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Any status</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button type="submit">Search</Button>
                            {search && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setSearch('');
                                        router.get('/users');
                                    }}
                                >
                                    Clear
                                </Button>
                            )}
                        </form>
                    </div>

                    {/* Users Table */}
                    <div className="rounded-lg border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Joined</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="text-center text-muted-foreground"
                                        >
                                            No users found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    users.data.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex items-center space-x-3">
                                                    <Avatar>
                                                        <AvatarFallback className="bg-primary/10 text-primary">
                                                            {getInitials(user.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium">{user.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center space-x-2">
                                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                                    <span>{user.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {user.role ? (
                                                    <Badge
                                                        variant={['super_admin', 'admin'].includes(user.role.name) ? 'default' : 'secondary'}
                                                    >
                                                        {user.role.display_name}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline">No role</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {user.is_active ? (
                                                    <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                                                        <CheckCircle className="mr-1 h-3 w-3" />
                                                        Active
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary">
                                                        <XCircle className="mr-1 h-3 w-3" />
                                                        Inactive
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">{formatDate(user.created_at)}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {user.last_login_at ? `Last sign-in ${formatDate(user.last_login_at)}` : 'Never signed in'}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end space-x-2">
                                                    {/* Toggle Active/Inactive */}
                                                    {can('toggle_user_active') && user.id !== auth.user.id && (isSuperAdmin || user.role?.name !== 'super_admin') && (
                                                    <Popover
                                                        open={toggleActivePopoverId === user.id}
                                                        onOpenChange={(open) =>
                                                            setToggleActivePopoverId(open ? user.id : null)
                                                        }
                                                    >
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className={user.is_active ? 'text-orange-500 hover:text-orange-600' : 'text-green-500 hover:text-green-600'}
                                                            >
                                                                {user.is_active ? (
                                                                    <XCircle className="h-4 w-4" />
                                                                ) : (
                                                                    <CheckCircle className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-80">
                                                            <div className="space-y-4">
                                                                <div className="space-y-2">
                                                                    <h4 className="font-semibold text-sm">
                                                                        {user.is_active ? 'Deactivate' : 'Activate'} User
                                                                    </h4>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        {user.is_active
                                                                            ? `Are you sure you want to deactivate ${user.name}? They will not be able to log in.`
                                                                            : `Are you sure you want to activate ${user.name}? They will be able to log in.`
                                                                        }
                                                                    </p>
                                                                </div>
                                                                <div className="flex justify-end space-x-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() =>
                                                                            setToggleActivePopoverId(null)
                                                                        }
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                    <Button
                                                                        variant={user.is_active ? 'destructive' : 'default'}
                                                                        size="sm"
                                                                        onClick={() => handleToggleActive(user.id)}
                                                                    >
                                                                        {user.is_active ? 'Deactivate' : 'Activate'}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                    )}

                                                    {can('update_users') && (isSuperAdmin || user.role?.name !== 'super_admin') && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEdit(user)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    )}
                                                    {can('delete_users') && user.id !== auth.user.id && (isSuperAdmin || user.role?.name !== 'super_admin') && (
                                                    <Popover
                                                        open={deletePopoverId === user.id}
                                                        onOpenChange={(open) =>
                                                            setDeletePopoverId(open ? user.id : null)
                                                        }
                                                    >
                                                        <PopoverTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-80">
                                                            <div className="space-y-4">
                                                                <div className="space-y-2">
                                                                    <h4 className="font-semibold text-sm">
                                                                        Delete User
                                                                    </h4>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        Are you sure you want to delete{' '}
                                                                        <strong>{user.name}</strong>? This
                                                                        action cannot be undone.
                                                                    </p>
                                                                </div>
                                                                <div className="flex justify-end space-x-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() =>
                                                                            setDeletePopoverId(null)
                                                                        }
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                    <Button
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        onClick={() => handleDelete(user.id)}
                                                                    >
                                                                        Delete
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        {/* Pagination */}
                        {users.last_page > 1 && (
                            <div className="flex items-center justify-between border-t px-6 py-4">
                                <div className="text-sm text-muted-foreground">
                                    Showing {(users.current_page - 1) * users.per_page + 1} to{' '}
                                    {Math.min(users.current_page * users.per_page, users.total)} of{' '}
                                    {users.total} users
                                </div>
                                <div className="flex space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={users.current_page === 1}
                                        onClick={() =>
                                            router.get('/users', {
                                                ...filters,
                                                page: users.current_page - 1,
                                            })
                                        }
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={users.current_page === users.last_page}
                                        onClick={() =>
                                            router.get('/users', {
                                                ...filters,
                                                page: users.current_page + 1,
                                            })
                                        }
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            {/* Edit User Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <form onSubmit={handleUpdate}>
                        <DialogHeader>
                            <DialogTitle>Edit User</DialogTitle>
                            <DialogDescription>Update user information</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Name</Label>
                                <Input
                                    id="edit-name"
                                    value={editForm.data.name}
                                    onChange={(e) => editForm.setData('name', e.target.value)}
                                    required
                                />
                                {editForm.errors.name && (
                                    <p className="text-sm text-destructive">
                                        {editForm.errors.name}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-email">Email</Label>
                                <Input
                                    id="edit-email"
                                    type="email"
                                    value={editForm.data.email}
                                    onChange={(e) => editForm.setData('email', e.target.value)}
                                    required
                                />
                                {editForm.errors.email && (
                                    <p className="text-sm text-destructive">
                                        {editForm.errors.email}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-role">Role</Label>
                                <Select
                                    value={editForm.data.role_id.toString()}
                                    onValueChange={(value) =>
                                        editForm.setData('role_id', parseInt(value))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map((role) => (
                                            <SelectItem key={role.id} value={role.id.toString()}>
                                                {role.display_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {editForm.errors.role_id && (
                                    <p className="text-sm text-destructive">
                                        {editForm.errors.role_id}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-password">
                                    New Password (leave blank to keep current)
                                </Label>
                                <Input
                                    id="edit-password"
                                    type="password"
                                    value={editForm.data.password}
                                    onChange={(e) => editForm.setData('password', e.target.value)}
                                    placeholder="••••••••"
                                />
                                {editForm.errors.password && (
                                    <p className="text-sm text-destructive">
                                        {editForm.errors.password}
                                    </p>
                                )}
                            </div>
                            {editForm.data.password && (
                                <div className="space-y-2">
                                    <Label htmlFor="edit-password-confirmation">
                                        Confirm Password
                                    </Label>
                                    <Input
                                        id="edit-password-confirmation"
                                        type="password"
                                        value={editForm.data.password_confirmation}
                                        onChange={(e) =>
                                            editForm.setData('password_confirmation', e.target.value)
                                        }
                                        placeholder="••••••••"
                                    />
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsEditOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={editForm.processing}>
                                {editForm.processing ? 'Updating...' : 'Update User'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

UsersIndex.layout = {
    breadcrumbs: [{ title: 'Users', href: '/users' }],
};
