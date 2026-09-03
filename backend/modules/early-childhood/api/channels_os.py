"""
Channels OS API Blueprint
AI GovCoreX OS — Gestión de Canales de Comunicación Multi-Tenant (OS Layer)

Note: This blueprint uses the prefix /channels-os to avoid collision with
the existing /channels blueprint (which manages per-license WhatsApp/Telegram).
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.channel_config import ChannelConfig, ChannelConversation
import logging

logger = logging.getLogger(__name__)

channels_os_bp = Blueprint('channels_os', __name__, url_prefix='/channels-os')


@channels_os_bp.route('/', methods=['GET'])
@jwt_required()
def list_channels():
    """Lista todos los canales OS configurados con filtros opcionales"""
    try:
        org_id = request.args.get('org_id', type=int)
        program_id = request.args.get('program_id', type=int)
        channel_type = request.args.get('channel_type')

        query = ChannelConfig.query.filter_by(is_active=True)
        if org_id:
            query = query.filter_by(org_id=org_id)
        if program_id:
            query = query.filter_by(program_id=program_id)
        if channel_type:
            query = query.filter_by(channel_type=channel_type)

        channels = query.all()
        return jsonify({'success': True, 'data': [c.to_dict() for c in channels], 'count': len(channels)})
    except Exception as e:
        logger.error(f'Error listing channels: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_bp.route('/', methods=['POST'])
@jwt_required()
def create_channel():
    """Crea una nueva configuración de canal OS"""
    try:
        data = request.get_json() or {}
        if not data.get('channel_type'):
            return jsonify({'success': False, 'error': 'Missing required field: channel_type'}), 400

        channel = ChannelConfig(
            org_id=data.get('org_id'),
            program_id=data.get('program_id'),
            license_id=data.get('license_id'),
            channel_type=data['channel_type'],
            channel_name=data.get('channel_name'),
            phone_number=data.get('phone_number'),
            session_id=data.get('session_id'),
            bot_token=data.get('bot_token'),
            bot_username=data.get('bot_username'),
            ownership_type=data.get('ownership_type', 'dedicated'),
            parent_channel_id=data.get('parent_channel_id'),
            access_level=data.get('access_level', 'program'),
            data_isolation_level=data.get('data_isolation_level', 'strict'),
            agent_name=data.get('agent_name'),
            agent_personality=data.get('agent_personality'),
            agent_voice=data.get('agent_voice', 'es-EC-LuisNeural'),
            welcome_message=data.get('welcome_message'),
            allowed_programs=data.get('allowed_programs', []),
            config_data=data.get('config_data', {}),
        )
        db.session.add(channel)
        db.session.commit()
        return jsonify({'success': True, 'data': channel.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error creating channel: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_bp.route('/<int:channel_id>', methods=['GET'])
@jwt_required()
def get_channel(channel_id: int):
    """Obtiene detalles de un canal OS"""
    try:
        channel = ChannelConfig.query.get_or_404(channel_id)
        return jsonify({'success': True, 'data': channel.to_dict()})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_bp.route('/<int:channel_id>', methods=['PUT'])
@jwt_required()
def update_channel(channel_id: int):
    """Actualiza configuración de un canal OS"""
    try:
        channel = ChannelConfig.query.get_or_404(channel_id)
        data = request.get_json() or {}

        updatable_fields = [
            'channel_name', 'access_level', 'data_isolation_level',
            'agent_name', 'agent_personality', 'agent_voice',
            'welcome_message', 'allowed_programs', 'config_data', 'is_active',
        ]
        for field in updatable_fields:
            if field in data:
                setattr(channel, field, data[field])

        db.session.commit()
        return jsonify({'success': True, 'data': channel.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_bp.route('/<int:channel_id>/conversations', methods=['GET'])
@jwt_required()
def list_conversations(channel_id: int):
    """Lista conversaciones de un canal OS"""
    try:
        status = request.args.get('status')
        query = ChannelConversation.query.filter_by(channel_id=channel_id)
        if status:
            query = query.filter_by(status=status)
        convs = query.order_by(ChannelConversation.last_message_at.desc()).limit(50).all()
        return jsonify({'success': True, 'data': [c.to_dict() for c in convs]})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_bp.route('/<int:channel_id>/conversations', methods=['POST'])
@jwt_required()
def create_conversation(channel_id: int):
    """Registra una nueva conversación en un canal OS"""
    try:
        data = request.get_json() or {}

        conv = ChannelConversation(
            channel_id=channel_id,
            program_id=data.get('program_id'),
            beneficiary_id=data.get('beneficiary_id'),
            external_id=data.get('external_id'),
            contact_name=data.get('contact_name'),
            contact_phone=data.get('contact_phone'),
            conversation_type=data.get('conversation_type', 'onboarding'),
            status=data.get('status', 'open'),
            current_step=data.get('current_step'),
            form_data_collected=data.get('form_data_collected', {}),
        )
        db.session.add(conv)
        db.session.commit()
        return jsonify({'success': True, 'data': conv.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@channels_os_bp.route('/stats', methods=['GET'])
@jwt_required()
def channels_stats():
    """Estadísticas globales del módulo de canales OS"""
    try:
        stats = {
            'channels': {
                'total': ChannelConfig.query.filter_by(is_active=True).count(),
                'whatsapp': ChannelConfig.query.filter_by(channel_type='whatsapp', is_active=True).count(),
                'telegram': ChannelConfig.query.filter_by(channel_type='telegram', is_active=True).count(),
                'connected': ChannelConfig.query.filter_by(status='connected', is_active=True).count(),
            },
            'conversations': {
                'total': ChannelConversation.query.count(),
                'open': ChannelConversation.query.filter_by(status='open').count(),
                'completed': ChannelConversation.query.filter_by(status='completed').count(),
            }
        }
        return jsonify({'success': True, 'data': stats})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
