import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Phone, User, Loader2, X, Check, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string | null;
  is_primary: boolean | null;
}

const EmergencyContactsManager = () => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRelationship, setFormRelationship] = useState('');
  const [formIsPrimary, setFormIsPrimary] = useState(false);

  // Fetch contacts
  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to load emergency contacts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // Reset form
  const resetForm = () => {
    setFormName('');
    setFormPhone('');
    setFormRelationship('');
    setFormIsPrimary(false);
    setEditingContact(null);
  };

  // Open dialog for adding
  const handleAddNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // Open dialog for editing
  const handleEdit = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setFormName(contact.name);
    setFormPhone(contact.phone);
    setFormRelationship(contact.relationship || '');
    setFormIsPrimary(contact.is_primary || false);
    setIsDialogOpen(true);
  };

  // Validate phone number
  const validatePhone = (phone: string): boolean => {
    // Accept formats: +1234567890, 1234567890, 123-456-7890, etc.
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    return /^\+?\d{10,15}$/.test(cleaned);
  };

  // Save contact (add or update)
  const handleSave = async () => {
    // Validate inputs
    if (!formName.trim()) {
      toast.error('Please enter a name');
      return;
    }
    if (!formPhone.trim()) {
      toast.error('Please enter a phone number');
      return;
    }
    if (!validatePhone(formPhone)) {
      toast.error('Please enter a valid phone number (10-15 digits)');
      return;
    }

    setIsSaving(true);
    
    try {
      // Format phone number
      let formattedPhone = formPhone.replace(/[\s\-\(\)]/g, '');
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+91' + formattedPhone; // Default to India country code
      }

      const contactData = {
        name: formName.trim(),
        phone: formattedPhone,
        relationship: formRelationship.trim() || null,
        is_primary: formIsPrimary,
      };

      if (editingContact) {
        // Update existing
        const { error } = await supabase
          .from('emergency_contacts')
          .update(contactData)
          .eq('id', editingContact.id);
        
        if (error) throw error;
        toast.success('Contact updated successfully');
      } else {
        // Add new
        const { error } = await supabase
          .from('emergency_contacts')
          .insert(contactData);
        
        if (error) throw error;
        toast.success('Contact added successfully');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchContacts();
    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error('Failed to save contact');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete contact
  const handleDelete = async () => {
    if (!deleteContactId) return;
    
    try {
      const { error } = await supabase
        .from('emergency_contacts')
        .delete()
        .eq('id', deleteContactId);
      
      if (error) throw error;
      toast.success('Contact deleted');
      fetchContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Failed to delete contact');
    } finally {
      setDeleteContactId(null);
    }
  };

  return (
    <div className="glass-strong rounded-2xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Emergency Contacts</h3>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={handleAddNew}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-border sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingContact ? 'Edit Contact' : 'Add Emergency Contact'}</DialogTitle>
              <DialogDescription>
                {editingContact 
                  ? 'Update the contact details below.'
                  : 'Add someone who will receive SOS alerts with your location.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Contact name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="pl-10"
                    maxLength={100}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    placeholder="+91 9876543210"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="pl-10"
                    maxLength={20}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Include country code for international numbers</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="relationship">Relationship (optional)</Label>
                <Input
                  id="relationship"
                  placeholder="e.g., Parent, Spouse, Friend"
                  value={formRelationship}
                  onChange={(e) => setFormRelationship(e.target.value)}
                  maxLength={50}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="primary"
                  checked={formIsPrimary}
                  onChange={(e) => setFormIsPrimary(e.target.checked)}
                  className="rounded border-border"
                />
                <Label htmlFor="primary" className="text-sm cursor-pointer">
                  Primary contact (will be called first)
                </Label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="hero"
                  className="flex-1"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      {editingContact ? 'Update' : 'Add Contact'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contacts List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Phone className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No emergency contacts yet</p>
            <p className="text-xs mt-1">Add contacts to receive SOS alerts</p>
          </div>
        ) : (
          contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  contact.is_primary ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  <User className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">{contact.name}</span>
                    {contact.is_primary && (
                      <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="truncate">{contact.phone}</span>
                    {contact.relationship && (
                      <>
                        <span className="text-border">•</span>
                        <span className="truncate">{contact.relationship}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleEdit(contact)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteContactId(contact.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteContactId} onOpenChange={() => setDeleteContactId(null)}>
        <AlertDialogContent className="glass-strong border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this emergency contact? They will no longer receive SOS alerts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EmergencyContactsManager;
