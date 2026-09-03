"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { UserPlus, MoreHorizontal, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem } from "../ui/dropdown-menu";
import { useRole } from "@/hooks/use-role";
import { usersService, type User } from "@/services/users.service";

export function SecurityClient() {
  const { role, center } = useRole();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await usersService.getAll();
        setUsers(data);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setIsLoading(false);
      }
    };
    if (role === 'admin') {
      fetchUsers();
    } else {
      setIsLoading(false);
    }
  }, [role]);

  if (role !== 'admin') {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No tiene permisos para acceder a este módulo.
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-end mb-4">
          <Button><UserPlus className="mr-2" /> Nuevo Usuario</Button>
        </div>
        <div className="border rounded-md overflow-hidden bg-card/50 border-border/20 backdrop-blur-lg">
          <Table>
            <TableHeader>
              <TableRow className="hidden md:table-row hover:bg-transparent">
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Centro Asignado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4">No hay usuarios registrados</TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <React.Fragment key={user.id}>
                    <TableRow className="md:hidden flex flex-col p-4 space-y-2 border-b border-border/10">
                      <TableCell>
                        <div className="font-medium text-base">{user.full_name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold md:hidden mr-2">Rol:</span>
                        <Badge variant={user.role === 'Administrador Master' ? 'default' : 'secondary'}>{user.role}</Badge>
                      </TableCell>
                      <TableCell><span className="font-semibold md:hidden mr-2">Centro:</span>{center}</TableCell>
                      <TableCell className="text-left md:text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full md:w-auto mt-2 bg-background/50">
                              <MoreHorizontal className="mr-2 h-4 w-4" />
                              Acciones
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background/80 backdrop-blur-lg border-border/30">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuItem>Editar Usuario</DropdownMenuItem>
                            <DropdownMenuItem>Reasignar Centro</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    <TableRow className="hidden md:table-row hover:bg-white/5">
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'Administrador Master' ? 'default' : 'secondary'}>{user.role}</Badge>
                      </TableCell>
                      <TableCell>{center}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-white/10">
                              <span className="sr-only">Abrir menú</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background/80 backdrop-blur-lg border-border/30">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuItem>Editar Usuario</DropdownMenuItem>
                            <DropdownMenuItem>Reasignar Centro</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                )))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}